import {
  bearer,
  fail,
  hasFlag,
  isHttpsUrl,
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

const API = 'https://open.tiktokapis.com/v2/post/publish';
const MB = 1024 * 1024;
const WHOLE_FILE_MAX = 64 * MB;
const CHUNK = 32 * MB;
const TITLE_LIMIT = 2200;

const PRIVACY: Record<string, string> = {
  self_only: 'SELF_ONLY',
  private: 'SELF_ONLY',
  mutual_follow_friends: 'MUTUAL_FOLLOW_FRIENDS',
  friends: 'MUTUAL_FOLLOW_FRIENDS',
  follower_of_creator: 'FOLLOWER_OF_CREATOR',
  followers: 'FOLLOWER_OF_CREATOR',
  public_to_everyone: 'PUBLIC_TO_EVERYONE',
  public: 'PUBLIC_TO_EVERYONE',
};

/** TikTok answers 200 with an `error.code` other than "ok" for some failures. */
function assertOk(json: Record<string, unknown>, step: string): void {
  const code = str(json, 'error', 'code');
  if (code && code !== 'ok') fail(`${step}: ${code} ${str(json, 'error', 'message') ?? ''}`.trim());
}

/** Chunk plan per TikTok's media transfer guide: 5-64 MB chunks, the last may absorb the rest. */
export function chunkPlan(size: number): { chunkSize: number; total: number } {
  if (size <= WHOLE_FILE_MAX) return { chunkSize: size, total: 1 };
  return { chunkSize: CHUNK, total: Math.floor(size / CHUNK) };
}

// TikTok Content Posting API, Direct Post (video).
// https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
// Token: user access token with the video.publish scope (env TIKTOK_ACCESS_TOKEN).
// Unaudited API clients can only post privately; the default privacy here is SELF_ONLY.
export const tiktok: Publisher = {
  tokenEnv: ['TIKTOK_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    if (input.media.length !== 1) fail('tiktok needs exactly one --media video (file path or URL)');
    const [ref] = input.media;
    const isUrl = isHttpsUrl(ref);
    const size = isUrl ? 0 : localFileSize('tiktok', ref);
    const mime = mimeOf(ref);
    if (!isUrl && !['video/mp4', 'video/quicktime', 'video/webm'].includes(mime)) {
      fail('tiktok accepts mp4, mov or webm video');
    }
    if ([...input.text].length > TITLE_LIMIT)
      fail(`tiktok caption is limited to ${TITLE_LIMIT} characters`);

    const privacyKey = (input.flags.privacy ?? 'self_only').toLowerCase();
    const privacy = PRIVACY[privacyKey];
    if (!privacy) fail(`--privacy for tiktok must be one of: ${Object.keys(PRIVACY).join(', ')}`);

    const headers = {
      ...bearer('TIKTOK_ACCESS_TOKEN'),
      'content-type': 'application/json; charset=UTF-8',
    };

    // 1. Creator info: the privacy level must be one the creator account offers.
    const info = await transport.send(
      { step: 'query creator info', method: 'POST', url: `${API}/creator_info/query/`, headers },
      {
        data: { creator_username: '<creator>', privacy_level_options: [privacy] },
        error: { code: 'ok' },
      }
    );
    assertOk(info.json, 'query creator info');
    const options = (info.json.data as { privacy_level_options?: string[] } | undefined)
      ?.privacy_level_options;
    if (options && !options.includes(privacy)) {
      fail(`tiktok account does not offer ${privacy}; it offers: ${options.join(', ')}`);
    }
    const creator = str(info.json, 'data', 'creator_username');

    // 2. Initialise the post.
    const plan = chunkPlan(size);
    const initBody = {
      post_info: {
        privacy_level: privacy,
        ...(input.text.trim() ? { title: input.text } : {}),
        disable_duet: hasFlag(input, 'disable-duet'),
        disable_comment: hasFlag(input, 'disable-comment'),
        disable_stitch: hasFlag(input, 'disable-stitch'),
        ...(input.flags['cover-ms']
          ? { video_cover_timestamp_ms: Number(input.flags['cover-ms']) }
          : {}),
        brand_content_toggle: hasFlag(input, 'paid-partnership'),
        brand_organic_toggle: hasFlag(input, 'promotes-own-business'),
        is_aigc: hasFlag(input, 'ai-generated'),
      },
      source_info: isUrl
        ? { source: 'PULL_FROM_URL', video_url: ref }
        : {
            source: 'FILE_UPLOAD',
            video_size: size,
            chunk_size: plan.chunkSize,
            total_chunk_count: plan.total,
          },
    };
    const init = await transport.send(
      {
        step: 'initialise direct post',
        method: 'POST',
        url: `${API}/video/init/`,
        headers,
        json: initBody,
      },
      {
        data: { publish_id: '<publish id>', upload_url: '<upload url>' },
        error: { code: 'ok' },
      }
    );
    assertOk(init.json, 'initialise direct post');
    const publishId = requireId(str(init.json, 'data', 'publish_id'), 'initialise direct post');

    // 3. Send the file, chunk by chunk, in order.
    if (!isUrl) {
      const uploadUrl = requireId(str(init.json, 'data', 'upload_url'), 'initialise direct post');
      for (let index = 0; index < plan.total; index++) {
        const start = index * plan.chunkSize;
        const end = index === plan.total - 1 ? size : start + plan.chunkSize;
        await transport.send({
          step: `upload chunk ${index + 1}/${plan.total}`,
          method: 'PUT',
          url: uploadUrl,
          headers: {
            'content-type': mime,
            'content-range': `bytes ${start}-${end - 1}/${size}`,
          },
          file: { path: ref, start, end },
        });
      }
    }

    // 4. Wait for TikTok to finish publishing.
    const finished = await poll(
      transport,
      input,
      async () => {
        const res = await transport.send(
          {
            step: 'check publish status',
            method: 'POST',
            url: `${API}/status/fetch/`,
            headers,
            json: { publish_id: publishId },
          },
          {
            data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['<post id>'] },
            error: { code: 'ok' },
          }
        );
        assertOk(res.json, 'check publish status');
        const status = str(res.json, 'data', 'status');
        if (status === 'FAILED')
          fail(
            `tiktok publish failed: ${str(res.json, 'data', 'fail_reason') ?? 'no reason given'}`
          );
        return { done: status === 'PUBLISH_COMPLETE', value: res.json };
      },
      `tiktok did not finish publishing in time (publish id ${publishId}); check it in the TikTok app`
    );

    // TikTok spells this field "publicaly_available_post_id" in its docs; accept both spellings.
    const data = (finished?.data ?? {}) as Record<string, unknown>;
    const ids = (data.publicaly_available_post_id ?? data.publicly_available_post_id) as
      | Array<string | number>
      | undefined;
    const postId = ids?.length ? String(ids[0]) : undefined;
    return {
      posted: true,
      platform: 'tiktok',
      postId: postId ?? publishId,
      url: postId && creator ? `https://www.tiktok.com/@${creator}/video/${postId}` : undefined,
      details: {
        publishId,
        privacy,
        note: postId ? undefined : 'No public post id yet: moderation may still be running.',
      },
    };
  },
};
