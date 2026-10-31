import {
  env,
  fail,
  type PostInput,
  type PostResult,
  type Publisher,
  requireFlag,
  requireId,
  requireUrls,
  str,
  type Transport,
} from '../core';

const DEFAULT_VERSION = 'v26.0';

// Facebook Pages API: text or link post on /{page-id}/feed, single photo on /{page-id}/photos.
// https://developers.facebook.com/docs/pages-api/posts/
// Needs a Page access token with pages_manage_posts. Video is not covered here: it goes through
// the Video API with a resumable-upload handle, which needs an app id and a user token.
export const facebook: Publisher = {
  tokenEnv: ['FACEBOOK_PAGE_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const pageId = requireFlag(input, 'account', 'FACEBOOK_PAGE_ID', 'Facebook Page id');
    const media = requireUrls('facebook', input.media);
    if (media.length > 1) fail('facebook supports one photo per post here; pass one --media URL');
    if (/\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(media[0] ?? '')) {
      fail('facebook video is not supported by this worker (Video API upload handle needed)');
    }
    if (!input.text.trim() && media.length === 0) fail('facebook needs --text or --media');

    const version = env('FACEBOOK_API_VERSION') || DEFAULT_VERSION;
    const token = env('FACEBOOK_PAGE_ACCESS_TOKEN');
    const base = `https://graph.facebook.com/${version}/${pageId}`;

    if (media.length === 1) {
      const res = await transport.send(
        {
          step: 'publish photo',
          method: 'POST',
          url: `${base}/photos`,
          form: {
            url: media[0],
            ...(input.text.trim() ? { caption: input.text } : {}),
            published: 'true',
            access_token: token,
          },
        },
        { id: '<photo id>', post_id: '<page post id>' }
      );
      const postId = requireId(str(res.json, 'post_id') ?? str(res.json, 'id'), 'publish photo');
      return {
        posted: true,
        platform: 'facebook',
        postId,
        url: `https://www.facebook.com/${postId}`,
      };
    }

    const res = await transport.send(
      {
        step: 'publish feed post',
        method: 'POST',
        url: `${base}/feed`,
        form: {
          message: input.text,
          ...(input.flags.link ? { link: input.flags.link } : {}),
          published: 'true',
          access_token: token,
        },
      },
      { id: '<page post id>' }
    );
    const postId = requireId(str(res.json, 'id'), 'publish feed post');
    return {
      posted: true,
      platform: 'facebook',
      postId,
      url: `https://www.facebook.com/${postId}`,
    };
  },
};
