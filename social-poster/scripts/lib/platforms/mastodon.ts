import {
  bearer,
  fail,
  localFileSize,
  mimeOf,
  type PostInput,
  type PostResult,
  type Publisher,
  poll,
  requireId,
  str,
  type Transport,
} from '../core';

function instanceBase(): string {
  const raw = process.env.MASTODON_BASE_URL ?? '';
  if (!raw) fail('MASTODON_BASE_URL is required (for example https://mastodon.social)');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(`MASTODON_BASE_URL is not a URL: ${raw}`);
  }
  if (url.protocol !== 'https:') fail('MASTODON_BASE_URL must be https');
  return url.origin;
}

// Mastodon: POST /api/v2/media (multipart) for each file, then POST /api/v1/statuses.
// https://docs.joinmastodon.org/methods/media/ and /methods/statuses/
// Token: OAuth user token with write:media and write:statuses.
export const mastodon: Publisher = {
  tokenEnv: ['MASTODON_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const base = instanceBase();
    if (!input.text.trim() && input.media.length === 0) fail('mastodon needs --text or --media');
    for (const path of input.media) localFileSize('mastodon', path);
    const visibility = input.flags.visibility?.toLowerCase();
    if (visibility && !['public', 'unlisted', 'private', 'direct'].includes(visibility)) {
      fail('--visibility for mastodon must be public, unlisted, private or direct');
    }

    const mediaIds: string[] = [];
    for (const [index, path] of input.media.entries()) {
      const upload = await transport.send(
        {
          step: `upload media ${index + 1}`,
          method: 'POST',
          url: `${base}/api/v2/media`,
          headers: bearer('MASTODON_ACCESS_TOKEN'),
          multipart: {
            fields: input.flags.alt ? { description: input.flags.alt } : {},
            file: { field: 'file', path, mime: mimeOf(path) },
          },
        },
        { id: `<media id ${index + 1}>` }
      );
      const mediaId = requireId(str(upload.json, 'id'), `upload media ${index + 1}`);
      if (upload.status === 202) {
        // Large media (video, audio) finishes processing in the background: wait for its url.
        await poll(
          transport,
          input,
          async () => {
            const res = await transport.send(
              {
                step: `check media ${index + 1} processing`,
                method: 'GET',
                url: `${base}/api/v1/media/${mediaId}`,
                headers: bearer('MASTODON_ACCESS_TOKEN'),
                okStatuses: [206],
              },
              { url: '<media url>' }
            );
            return { done: res.status === 200 && Boolean(str(res.json, 'url')) };
          },
          `mastodon media ${mediaId} did not finish processing in time`
        );
      }
      mediaIds.push(mediaId);
    }

    const form: Record<string, string | string[]> = {};
    if (input.text.trim()) form.status = input.text;
    if (mediaIds.length) form['media_ids[]'] = mediaIds;
    if (visibility) form.visibility = visibility;
    if (input.flags['reply-to']) form.in_reply_to_id = input.flags['reply-to'];
    if (input.flags['spoiler-text']) form.spoiler_text = input.flags['spoiler-text'];
    if (input.flags.sensitive === 'true') form.sensitive = 'true';
    if (input.flags.language) form.language = input.flags.language;

    const res = await transport.send(
      {
        step: 'create status',
        method: 'POST',
        url: `${base}/api/v1/statuses`,
        headers: bearer('MASTODON_ACCESS_TOKEN'),
        form,
      },
      { id: '<status id>', url: `${base}/@you/<status id>` }
    );
    const postId = requireId(str(res.json, 'id'), 'create status');
    return { posted: true, platform: 'mastodon', postId, url: str(res.json, 'url') };
  },
};
