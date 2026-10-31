import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chunkPlan } from './lib/platforms/tiktok';
import { run } from './post';

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
}

interface Reply {
  status?: number;
  json?: unknown;
  headers?: Record<string, string>;
}

const realFetch = globalThis.fetch;
const savedEnv = { ...process.env };
let calls: Call[] = [];

/** Replace global fetch with a script of replies, consumed in order. */
function scriptFetch(replies: Reply[]): void {
  calls = [];
  let index = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const body = init?.body;
    let bodyText = '';
    if (typeof body === 'string') bodyText = body;
    else if (body instanceof FormData) {
      bodyText = JSON.stringify(
        [...body.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : 'file'])
      );
    } else if (body instanceof Blob) bodyText = `blob:${body.size}`;
    calls.push({ method: init?.method ?? 'GET', url: String(input), headers, body: bodyText });
    const reply = replies[index++];
    if (!reply) throw new Error(`unexpected request #${index}: ${init?.method} ${String(input)}`);
    return new Response(JSON.stringify(reply.json ?? {}), {
      status: reply.status ?? 200,
      headers: reply.headers,
    });
  }) as typeof fetch;
}

function bodyOf(call: Call): Record<string, unknown> {
  return JSON.parse(call.body) as Record<string, unknown>;
}

function formOf(call: Call): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(call.body));
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'social-poster-'));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, savedEnv);
});

describe('approval gate', () => {
  it('dry run sends nothing and masks the token', async () => {
    scriptFetch([]);
    process.env.THREADS_ACCESS_TOKEN = 'THREADS-SECRET-9999';
    const result = await run(['--platform', 'threads', '--account', '42', '--text', 'hi'], '');
    expect(calls).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain('THREADS-SECRET');
    expect(JSON.stringify(result)).toContain('****9999');
  });

  it('refuses a live run when the token is missing, before any request', async () => {
    scriptFetch([]);
    delete process.env.X_BEARER_TOKEN;
    await expect(run(['--platform', 'x', '--text', 'hi', '--confirm'], '')).rejects.toThrow(
      'X_BEARER_TOKEN not set'
    );
    expect(calls).toHaveLength(0);
  });

  it('rejects an unknown platform', async () => {
    await expect(run(['--platform', 'myspace', '--text', 'hi'], '')).rejects.toThrow(
      '--platform must be one of'
    );
  });
});

describe('x and linkedin', () => {
  it('posts a tweet with media ids and a reply target', async () => {
    process.env.X_BEARER_TOKEN = 'tok';
    scriptFetch([{ json: { data: { id: '1799' } } }]);
    const result = await run(
      ['--platform', 'x', '--text', 'gm', '--media-ids', 'a,b', '--reply-to', '55', '--confirm'],
      ''
    );
    expect(bodyOf(calls[0])).toEqual({
      text: 'gm',
      media: { media_ids: ['a', 'b'] },
      reply: { in_reply_to_tweet_id: '55' },
    });
    expect(result).toEqual({
      posted: true,
      platform: 'x',
      postId: '1799',
      url: 'https://x.com/i/web/status/1799',
    });
  });

  it('takes a Derivative on stdin', async () => {
    process.env.X_BEARER_TOKEN = 'tok';
    scriptFetch([{ json: { data: { id: '7' } } }]);
    await run(['--platform', 'x', '--confirm'], '{"copy":"from stdin","mediaRefs":["m1"]}');
    expect(bodyOf(calls[0])).toEqual({ text: 'from stdin', media: { media_ids: ['m1'] } });
  });

  it('posts to LinkedIn and reads the post urn from the header', async () => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'tok';
    scriptFetch([{ status: 201, headers: { 'x-restli-id': 'urn:li:share:9' } }]);
    const result = await run(
      ['--platform', 'linkedin', '--author', 'urn:li:person:1', '--text', 'hello', '--confirm'],
      ''
    );
    expect(calls[0].headers['linkedin-version']).toBe('202505');
    expect(result).toMatchObject({ postId: 'urn:li:share:9' });
  });

  it('requires an author for LinkedIn', async () => {
    await expect(run(['--platform', 'linkedin', '--text', 'hello'], '')).rejects.toThrow(
      '--author'
    );
  });
});

describe('threads', () => {
  beforeEach(() => {
    process.env.THREADS_ACCESS_TOKEN = 'tok';
  });

  it('publishes a text post in two requests and finds the permalink', async () => {
    scriptFetch([
      { json: { id: 'c1' } },
      { json: { id: 'p1' } },
      { json: { permalink: 'https://www.threads.com/@a/post/x' } },
    ]);
    const result = await run(
      ['--platform', 'threads', '--account', '42', '--text', 'hi', '--ai-generated', '--confirm'],
      ''
    );
    expect(formOf(calls[0])).toMatchObject({
      media_type: 'TEXT',
      text: 'hi',
      is_made_with_ai: 'true',
    });
    expect(calls[1].url).toBe('https://graph.threads.com/v1.0/42/threads_publish');
    expect(formOf(calls[1])).toMatchObject({ creation_id: 'c1' });
    expect(result).toMatchObject({ postId: 'p1', url: 'https://www.threads.com/@a/post/x' });
  });

  it('still reports success when the permalink lookup fails', async () => {
    scriptFetch([
      { json: { id: 'c1' } },
      { json: { id: 'p1' } },
      { status: 400, json: { error: 'x' } },
    ]);
    const result = await run(
      ['--platform', 'threads', '--account', '42', '--text', 'hi', '--confirm'],
      ''
    );
    expect(result).toMatchObject({ posted: true, postId: 'p1', url: undefined });
  });

  it('builds a carousel from child containers', async () => {
    scriptFetch([
      { json: { id: 'k1' } },
      { json: { status: 'FINISHED' } },
      { json: { id: 'k2' } },
      { json: { status: 'FINISHED' } },
      { json: { id: 'car' } },
      { json: { status: 'FINISHED' } },
      { json: { id: 'p2' } },
      { json: {} },
    ]);
    await run(
      [
        '--platform',
        'threads',
        '--account',
        '42',
        '--text',
        'two',
        '--media',
        'https://x.test/a.jpg,https://x.test/b.mp4',
        '--confirm',
      ],
      ''
    );
    expect(formOf(calls[2])).toMatchObject({
      is_carousel_item: 'true',
      media_type: 'VIDEO',
      video_url: 'https://x.test/b.mp4',
    });
    expect(formOf(calls[4])).toMatchObject({
      media_type: 'CAROUSEL',
      children: 'k1,k2',
      text: 'two',
    });
  });

  it('waits while a container is in progress, then publishes', async () => {
    scriptFetch([
      { json: { id: 'v1' } },
      { json: { status: 'IN_PROGRESS' } },
      { json: { status: 'FINISHED' } },
      { json: { id: 'p3' } },
      { json: {} },
    ]);
    await run(
      [
        '--platform',
        'threads',
        '--account',
        '42',
        '--media',
        'https://x.test/v.mp4',
        '--poll-seconds',
        '0',
        '--confirm',
      ],
      ''
    );
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'GET', 'POST', 'GET']);
  });

  it('fails with the platform error when processing fails', async () => {
    scriptFetch([
      { json: { id: 'v1' } },
      { json: { status: 'ERROR', error_message: 'FAILED_DOWNLOADING_VIDEO' } },
    ]);
    await expect(
      run(
        [
          '--platform',
          'threads',
          '--account',
          '42',
          '--media',
          'https://x.test/v.mp4',
          '--confirm',
        ],
        ''
      )
    ).rejects.toThrow('FAILED_DOWNLOADING_VIDEO');
  });

  it.each([
    ['text over 500 characters', ['--text', 'a'.repeat(501)], '500 characters'],
    ['a local path instead of a URL', ['--text', 'x', '--media', './pic.jpg'], 'public https URL'],
  ])('rejects %s', async (_name, extra, message) => {
    await expect(run(['--platform', 'threads', '--account', '42', ...extra], '')).rejects.toThrow(
      message
    );
  });
});

describe('instagram', () => {
  beforeEach(() => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'tok';
  });

  it('publishes a reel after the container finishes', async () => {
    scriptFetch([
      { json: { id: 'r1' } },
      { json: { status_code: 'IN_PROGRESS' } },
      { json: { status_code: 'FINISHED' } },
      { json: { id: 'm1' } },
      { json: { permalink: 'https://www.instagram.com/reel/abc/' } },
    ]);
    const result = await run(
      [
        '--platform',
        'instagram',
        '--account',
        '9',
        '--media',
        'https://x.test/r.mp4',
        '--text',
        'cap',
        '--poll-seconds',
        '0',
        '--confirm',
      ],
      ''
    );
    expect(calls[0].url).toBe('https://graph.instagram.com/v26.0/9/media');
    expect(calls[0].headers.authorization).toBe('Bearer tok');
    expect(bodyOf(calls[0])).toEqual({
      media_type: 'REELS',
      video_url: 'https://x.test/r.mp4',
      caption: 'cap',
    });
    expect(bodyOf(calls[3])).toEqual({ creation_id: 'r1' });
    expect(result).toMatchObject({ postId: 'm1', url: 'https://www.instagram.com/reel/abc/' });
  });

  it('creates carousel items, then the carousel, then publishes', async () => {
    scriptFetch([
      { json: { id: 'i1' } },
      { json: { id: 'i2' } },
      { json: { id: 'car' } },
      { json: { id: 'm2' } },
      { json: {} },
    ]);
    await run(
      [
        '--platform',
        'instagram',
        '--account',
        '9',
        '--media',
        'https://x.test/1.jpg,https://x.test/2.jpg',
        '--text',
        'cap',
        '--ai-generated',
        '--confirm',
      ],
      ''
    );
    expect(bodyOf(calls[0])).toEqual({ is_carousel_item: true, image_url: 'https://x.test/1.jpg' });
    expect(bodyOf(calls[2])).toEqual({
      media_type: 'CAROUSEL',
      children: 'i1,i2',
      caption: 'cap',
      is_ai_generated: true,
    });
  });

  it.each([
    ['a PNG image', ['--media', 'https://x.test/a.png'], 'JPEG'],
    ['a local file', ['--media', './a.jpg'], 'public https URL'],
    ['no media', [], 'needs --media'],
    [
      'a reel type with an image',
      ['--media', 'https://x.test/a.jpg', '--type', 'reel'],
      'video URL',
    ],
  ])('rejects %s', async (_name, extra, message) => {
    await expect(run(['--platform', 'instagram', '--account', '9', ...extra], '')).rejects.toThrow(
      message
    );
  });
});

describe('facebook', () => {
  beforeEach(() => {
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = 'tok';
  });

  it('posts a link to the page feed', async () => {
    scriptFetch([{ json: { id: '1_2' } }]);
    const result = await run(
      [
        '--platform',
        'facebook',
        '--account',
        '1',
        '--text',
        'read this',
        '--link',
        'https://x.test',
        '--confirm',
      ],
      ''
    );
    expect(calls[0].url).toBe('https://graph.facebook.com/v26.0/1/feed');
    expect(formOf(calls[0])).toMatchObject({ message: 'read this', link: 'https://x.test' });
    expect(result).toMatchObject({ url: 'https://www.facebook.com/1_2' });
  });

  it('posts a photo with a caption and uses post_id', async () => {
    scriptFetch([{ json: { id: 'photo', post_id: '1_3' } }]);
    const result = await run(
      [
        '--platform',
        'facebook',
        '--account',
        '1',
        '--text',
        'cap',
        '--media',
        'https://x.test/a.jpg',
        '--confirm',
      ],
      ''
    );
    expect(calls[0].url).toBe('https://graph.facebook.com/v26.0/1/photos');
    expect(formOf(calls[0])).toMatchObject({ url: 'https://x.test/a.jpg', caption: 'cap' });
    expect(result).toMatchObject({ postId: '1_3' });
  });

  it('rejects video', async () => {
    await expect(
      run(['--platform', 'facebook', '--account', '1', '--media', 'https://x.test/a.mp4'], '')
    ).rejects.toThrow('video is not supported');
  });
});

describe('pinterest', () => {
  it('creates a pin on a board', async () => {
    process.env.PINTEREST_ACCESS_TOKEN = 'tok';
    scriptFetch([{ json: { id: '555' } }]);
    const result = await run(
      [
        '--platform',
        'pinterest',
        '--account',
        '123',
        '--title',
        'T',
        '--text',
        'desc',
        '--link',
        'https://x.test',
        '--media',
        'https://x.test/p.jpg',
        '--confirm',
      ],
      ''
    );
    expect(bodyOf(calls[0])).toEqual({
      board_id: '123',
      media_source: { source_type: 'image_url', url: 'https://x.test/p.jpg' },
      title: 'T',
      description: 'desc',
      link: 'https://x.test',
    });
    expect(result).toMatchObject({ url: 'https://www.pinterest.com/pin/555/' });
  });

  it('rejects a title over 100 characters', async () => {
    await expect(
      run(
        [
          '--platform',
          'pinterest',
          '--account',
          '1',
          '--media',
          'https://x.test/p.jpg',
          '--title',
          'a'.repeat(101),
        ],
        ''
      )
    ).rejects.toThrow('100 characters');
  });
});

describe('mastodon', () => {
  beforeEach(() => {
    process.env.MASTODON_ACCESS_TOKEN = 'tok';
    process.env.MASTODON_BASE_URL = 'https://masto.test';
  });

  it('posts text with default visibility left to the server', async () => {
    scriptFetch([{ json: { id: 's1', url: 'https://masto.test/@me/s1' } }]);
    const result = await run(
      ['--platform', 'mastodon', '--text', 'hello', '--visibility', 'unlisted', '--confirm'],
      ''
    );
    expect(calls[0].url).toBe('https://masto.test/api/v1/statuses');
    expect(formOf(calls[0])).toEqual({ status: 'hello', visibility: 'unlisted' });
    expect(result).toMatchObject({ postId: 's1', url: 'https://masto.test/@me/s1' });
  });

  it('uploads a file, waits for async processing, and attaches it', async () => {
    const file = join(dir, 'clip.mp4');
    writeFileSync(file, 'not really a video');
    scriptFetch([
      { status: 202, json: { id: 'm9', url: null } },
      { status: 206, json: { id: 'm9', url: null } },
      { status: 200, json: { id: 'm9', url: 'https://masto.test/m9.mp4' } },
      { json: { id: 's2', url: 'https://masto.test/@me/s2' } },
    ]);
    await run(
      [
        '--platform',
        'mastodon',
        '--text',
        'clip',
        '--media',
        file,
        '--alt',
        'a clip',
        '--poll-seconds',
        '0',
        '--confirm',
      ],
      ''
    );
    expect(calls[0].url).toBe('https://masto.test/api/v2/media');
    expect(calls[0].body).toContain('a clip');
    expect(new URLSearchParams(calls[3].body).getAll('media_ids[]')).toEqual(['m9']);
  });

  it('rejects a plain-http instance', async () => {
    process.env.MASTODON_BASE_URL = 'http://masto.test';
    await expect(run(['--platform', 'mastodon', '--text', 'x'], '')).rejects.toThrow(
      'must be https'
    );
  });
});

describe('youtube', () => {
  it('starts a resumable session, uploads to its Location, and defaults to private', async () => {
    process.env.YOUTUBE_ACCESS_TOKEN = 'tok';
    const file = join(dir, 'v.mp4');
    writeFileSync(file, '0123456789');
    scriptFetch([
      { headers: { location: 'https://upload.test/session' } },
      { status: 200, json: { id: 'vid1' } },
    ]);
    const result = await run(
      [
        '--platform',
        'youtube',
        '--media',
        file,
        '--text',
        'My title\nLong description',
        '--tags',
        'a, b',
        '--confirm',
      ],
      ''
    );
    expect(calls[0].headers['x-upload-content-length']).toBe('10');
    expect(bodyOf(calls[0])).toEqual({
      snippet: {
        title: 'My title',
        description: 'My title\nLong description',
        tags: ['a', 'b'],
        categoryId: '22',
      },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    });
    expect(calls[1]).toMatchObject({
      method: 'PUT',
      url: 'https://upload.test/session',
      body: 'blob:10',
    });
    expect(result).toMatchObject({ postId: 'vid1', url: 'https://www.youtube.com/watch?v=vid1' });
  });

  it('marks synthetic media when asked', async () => {
    const file = join(dir, 'v.mp4');
    writeFileSync(file, 'x');
    const result = (await run(
      [
        '--platform',
        'youtube',
        '--media',
        file,
        '--title',
        'T',
        '--ai-generated',
        '--privacy',
        'public',
      ],
      ''
    )) as {
      willSend: Array<{ body: { status: Record<string, unknown> } }>;
    };
    expect(result.willSend[0].body.status).toEqual({
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
    });
  });

  it('rejects a missing file', async () => {
    await expect(
      run(['--platform', 'youtube', '--media', join(dir, 'nope.mp4'), '--title', 'T'], '')
    ).rejects.toThrow('cannot read media file');
  });
});

describe('tiktok', () => {
  beforeEach(() => {
    process.env.TIKTOK_ACCESS_TOKEN = 'tok';
  });

  it.each([
    [1, { chunkSize: 1, total: 1 }],
    [4 * 1024 * 1024, { chunkSize: 4 * 1024 * 1024, total: 1 }],
    [64 * 1024 * 1024, { chunkSize: 64 * 1024 * 1024, total: 1 }],
    [100 * 1024 * 1024, { chunkSize: 32 * 1024 * 1024, total: 3 }],
  ])('plans chunks for %d bytes', (size, expected) => {
    expect(chunkPlan(size)).toEqual(expected);
  });

  it('queries creator info, initialises, uploads the file and waits for publish', async () => {
    const file = join(dir, 'v.mp4');
    writeFileSync(file, 'abcdefghij');
    scriptFetch([
      {
        json: {
          data: {
            creator_username: 'me',
            privacy_level_options: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'],
          },
          error: { code: 'ok' },
        },
      },
      {
        json: {
          data: { publish_id: 'pub1', upload_url: 'https://upload.tiktok.test/x' },
          error: { code: 'ok' },
        },
      },
      { status: 201 },
      { json: { data: { status: 'PROCESSING_UPLOAD' }, error: { code: 'ok' } } },
      {
        json: {
          data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [7001] },
          error: { code: 'ok' },
        },
      },
    ]);
    const result = await run(
      [
        '--platform',
        'tiktok',
        '--media',
        file,
        '--text',
        'caption',
        '--poll-seconds',
        '0',
        '--ai-generated',
        '--confirm',
      ],
      ''
    );
    expect(bodyOf(calls[1])).toMatchObject({
      post_info: { privacy_level: 'SELF_ONLY', title: 'caption', is_aigc: true },
      source_info: { source: 'FILE_UPLOAD', video_size: 10, chunk_size: 10, total_chunk_count: 1 },
    });
    expect(calls[2]).toMatchObject({ method: 'PUT', url: 'https://upload.tiktok.test/x' });
    expect(calls[2].headers['content-range']).toBe('bytes 0-9/10');
    expect(result).toMatchObject({ postId: '7001', url: 'https://www.tiktok.com/@me/video/7001' });
  });

  it('refuses a privacy level the account does not offer', async () => {
    const file = join(dir, 'v.mp4');
    writeFileSync(file, 'abc');
    scriptFetch([
      { json: { data: { privacy_level_options: ['SELF_ONLY'] }, error: { code: 'ok' } } },
    ]);
    await expect(
      run(['--platform', 'tiktok', '--media', file, '--privacy', 'public', '--confirm'], '')
    ).rejects.toThrow('does not offer PUBLIC_TO_EVERYONE');
    expect(calls).toHaveLength(1);
  });

  it('surfaces an error code returned with HTTP 200', async () => {
    const file = join(dir, 'v.mp4');
    writeFileSync(file, 'abc');
    scriptFetch([
      { json: { error: { code: 'spam_risk_too_many_posts', message: 'cap reached' } } },
    ]);
    await expect(run(['--platform', 'tiktok', '--media', file, '--confirm'], '')).rejects.toThrow(
      'spam_risk_too_many_posts'
    );
  });

  it('pulls from a URL without uploading', async () => {
    scriptFetch([
      { json: { data: { privacy_level_options: ['SELF_ONLY'] }, error: { code: 'ok' } } },
      { json: { data: { publish_id: 'pub2' }, error: { code: 'ok' } } },
      {
        json: {
          data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: [] },
          error: { code: 'ok' },
        },
      },
    ]);
    const result = await run(
      ['--platform', 'tiktok', '--media', 'https://verified.test/v.mp4', '--confirm'],
      ''
    );
    expect(bodyOf(calls[1])).toMatchObject({
      source_info: { source: 'PULL_FROM_URL', video_url: 'https://verified.test/v.mp4' },
    });
    expect(result).toMatchObject({ postId: 'pub2' });
  });
});
