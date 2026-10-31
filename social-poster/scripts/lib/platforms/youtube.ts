import {
  bearer,
  env,
  fail,
  hasFlag,
  localFileSize,
  mimeOf,
  type PostInput,
  type PostResult,
  type Publisher,
  requireId,
  str,
  type Transport,
} from '../core';

const PRIVACY = ['private', 'unlisted', 'public'];

// YouTube Data API v3 videos.insert, resumable upload protocol.
// https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
// Token: OAuth 2.0 access token with the youtube.upload scope (env YOUTUBE_ACCESS_TOKEN).
// Quota: one upload costs 100 calls of the daily Video Uploads quota bucket (per the API docs).
export const youtube: Publisher = {
  tokenEnv: ['YOUTUBE_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    if (input.media.length !== 1) fail('youtube needs exactly one --media video file');
    const [path] = input.media;
    const size = localFileSize('youtube', path);

    const firstLine = input.text.split('\n')[0].trim();
    const title = input.flags.title ?? firstLine;
    if (!title) fail('youtube needs --title (or text whose first line becomes the title)');
    const privacy = (input.flags.privacy ?? 'private').toLowerCase();
    if (!PRIVACY.includes(privacy))
      fail('--privacy for youtube must be private, unlisted or public');

    const tags = (input.flags.tags ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    const mime = mimeOf(path).startsWith('video/') ? mimeOf(path) : 'application/octet-stream';

    const init = await transport.send(
      {
        step: 'start resumable session',
        method: 'POST',
        url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        headers: {
          ...bearer('YOUTUBE_ACCESS_TOKEN'),
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-length': String(size),
          'x-upload-content-type': mime,
        },
        json: {
          snippet: {
            title,
            description: input.text,
            ...(tags.length ? { tags } : {}),
            categoryId: input.flags['category-id'] ?? '22',
          },
          status: {
            privacyStatus: privacy,
            selfDeclaredMadeForKids: hasFlag(input, 'made-for-kids'),
            ...(hasFlag(input, 'ai-generated') ? { containsSyntheticMedia: true } : {}),
          },
        },
      },
      {}
    );
    const session = init.headers.location ?? (transport.isDryRun ? '<resumable session uri>' : '');
    if (!session) fail('youtube did not return a resumable session URI (Location header)');

    const uploaded = await transport.send(
      {
        step: 'upload video',
        method: 'PUT',
        url: session,
        headers: { authorization: `Bearer ${env('YOUTUBE_ACCESS_TOKEN')}`, 'content-type': mime },
        file: { path, start: 0, end: size },
      },
      { id: '<video id>' }
    );
    const id = requireId(str(uploaded.json, 'id'), 'upload video');
    return {
      posted: true,
      platform: 'youtube',
      postId: id,
      url: `https://www.youtube.com/watch?v=${id}`,
      details: { privacy },
    };
  },
};
