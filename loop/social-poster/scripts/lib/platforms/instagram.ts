import {
  env,
  fail,
  hasFlag,
  isImageRef,
  isVideoRef,
  type PostInput,
  type PostResult,
  type Publisher,
  poll,
  requireFlag,
  requireId,
  requireUrls,
  str,
  type Transport,
} from '../core';

const DEFAULT_HOST = 'https://graph.instagram.com';
const DEFAULT_VERSION = 'v26.0';
const JPEG = /\.jpe?g(\?.*)?$/i;

type InstagramType = 'image' | 'reel' | 'story' | 'carousel';

// Instagram API content publishing: create a container, wait for it, media_publish.
// https://developers.facebook.com/docs/instagram-platform/content-publishing/
// Token: Instagram User access token (graph.instagram.com) or a Facebook Page token
// (set INSTAGRAM_GRAPH_HOST=https://graph.facebook.com).
export const instagram: Publisher = {
  tokenEnv: ['INSTAGRAM_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const igId = requireFlag(input, 'account', 'INSTAGRAM_USER_ID', 'Instagram account id');
    const media = requireUrls('instagram', input.media);
    if (media.length === 0) fail('instagram needs --media (a public https URL per item)');
    if (media.length > 20) fail('instagram carousels hold at most 20 items');

    const requested = input.flags.type as InstagramType | undefined;
    if (requested && !['image', 'reel', 'story', 'carousel'].includes(requested)) {
      fail('--type must be image, reel, story or carousel');
    }
    const kind: InstagramType =
      requested ?? (media.length > 1 ? 'carousel' : isVideoRef(media[0]) ? 'reel' : 'image');
    if (kind === 'carousel' && media.length < 2) fail('instagram carousels need 2 to 20 items');
    if (kind !== 'carousel' && media.length > 1) fail(`--type ${kind} takes one media item`);
    if (kind === 'reel' && !isVideoRef(media[0])) fail('instagram reels need a video URL');
    for (const ref of media) {
      if (isImageRef(ref) && !JPEG.test(ref)) {
        fail(`instagram accepts JPEG images only, got "${ref}"`);
      }
    }

    const host = env('INSTAGRAM_GRAPH_HOST') || DEFAULT_HOST;
    const version = env('INSTAGRAM_API_VERSION') || DEFAULT_VERSION;
    const base = `${host}/${version}`;
    const headers = () => ({
      authorization: `Bearer ${env('INSTAGRAM_ACCESS_TOKEN')}`,
      'content-type': 'application/json',
    });

    const aiLabel = hasFlag(input, 'ai-generated') ? { is_ai_generated: true } : {};
    const caption = input.text.trim() ? { caption: input.text } : {};

    const createContainer = async (step: string, body: Record<string, unknown>) => {
      const res = await transport.send(
        { step, method: 'POST', url: `${base}/${igId}/media`, headers: headers(), json: body },
        { id: '<container id>' }
      );
      return requireId(str(res.json, 'id'), step);
    };

    const waitFinished = (containerId: string, label: string) =>
      poll(
        transport,
        input,
        async () => {
          const res = await transport.send(
            {
              step: `check ${label} status`,
              method: 'GET',
              url: `${base}/${containerId}?fields=status_code`,
              headers: { authorization: headers().authorization },
            },
            { status_code: 'FINISHED' }
          );
          const status = str(res.json, 'status_code');
          if (status === 'ERROR' || status === 'EXPIRED') fail(`instagram ${label} ${status}`);
          return { done: status === 'FINISHED' || status === 'PUBLISHED', value: status };
        },
        `instagram ${label} did not finish processing in time (container ${containerId})`
      );

    const mediaFields = (ref: string): Record<string, unknown> =>
      isVideoRef(ref) ? { video_url: ref } : { image_url: ref };

    let containerId: string;
    if (kind === 'image') {
      containerId = await createContainer('create image container', {
        image_url: media[0],
        ...caption,
        ...(input.flags.alt ? { alt_text: input.flags.alt } : {}),
        ...aiLabel,
      });
    } else if (kind === 'reel') {
      containerId = await createContainer('create reel container', {
        media_type: 'REELS',
        video_url: media[0],
        ...caption,
        ...(input.flags['share-to-feed']
          ? { share_to_feed: input.flags['share-to-feed'] === 'true' }
          : {}),
        ...(input.flags['cover-url'] ? { cover_url: input.flags['cover-url'] } : {}),
        ...aiLabel,
      });
      await waitFinished(containerId, 'reel container');
    } else if (kind === 'story') {
      containerId = await createContainer('create story container', {
        media_type: 'STORIES',
        ...mediaFields(media[0]),
        ...aiLabel,
      });
      if (isVideoRef(media[0])) await waitFinished(containerId, 'story container');
    } else {
      const children: string[] = [];
      for (const [index, ref] of media.entries()) {
        const childId = await createContainer(`create carousel item ${index + 1}`, {
          is_carousel_item: true,
          ...(isVideoRef(ref) ? { media_type: 'VIDEO' } : {}),
          ...mediaFields(ref),
        });
        if (isVideoRef(ref)) await waitFinished(childId, `carousel item ${index + 1}`);
        children.push(childId);
      }
      containerId = await createContainer('create carousel container', {
        media_type: 'CAROUSEL',
        children: children.join(','),
        ...caption,
        ...aiLabel,
      });
    }

    const published = await transport.send(
      {
        step: 'publish container',
        method: 'POST',
        url: `${base}/${igId}/media_publish`,
        headers: headers(),
        json: { creation_id: containerId },
      },
      { id: '<instagram media id>' }
    );
    const postId = requireId(str(published.json, 'id'), 'publish container');

    // Best effort: the post is already live, so a failed permalink lookup is not an error.
    let url: string | undefined;
    try {
      const link = await transport.send(
        {
          step: 'look up permalink',
          method: 'GET',
          url: `${base}/${postId}?fields=permalink`,
          headers: { authorization: headers().authorization },
        },
        { permalink: '<permalink>' }
      );
      url = str(link.json, 'permalink');
    } catch {
      url = undefined;
    }
    return { posted: true, platform: 'instagram', postId, url, details: { kind } };
  },
};
