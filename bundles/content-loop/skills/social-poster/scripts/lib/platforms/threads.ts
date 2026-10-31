import {
  fail,
  hasFlag,
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

const GRAPH = 'https://graph.threads.com/v1.0';
const TEXT_LIMIT = 500;

// Threads API: create a media container, wait for it, publish it.
// https://developers.facebook.com/docs/threads/posts/
export const threads: Publisher = {
  tokenEnv: ['THREADS_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const userId = requireFlag(input, 'account', 'THREADS_USER_ID', 'Threads user id');
    const media = requireUrls('threads', input.media);
    if (!input.text.trim() && media.length === 0) fail('threads needs --text or --media');
    if ([...input.text].length > TEXT_LIMIT) {
      fail(`threads text is limited to ${TEXT_LIMIT} characters (emoji may count as UTF-8 bytes)`);
    }
    if (media.length > 20) fail('threads carousels hold at most 20 items');

    const token = () => process.env.THREADS_ACCESS_TOKEN ?? '';
    const aiLabel: Record<string, string> = hasFlag(input, 'ai-generated')
      ? { is_made_with_ai: 'true' }
      : {};
    const replyTo: Record<string, string> = input.flags['reply-to']
      ? { reply_to_id: input.flags['reply-to'] }
      : {};
    const replyControl: Record<string, string> = input.flags['reply-control']
      ? { reply_control: input.flags['reply-control'] }
      : {};

    const createContainer = async (step: string, fields: Record<string, string>) => {
      const res = await transport.send(
        {
          step,
          method: 'POST',
          url: `${GRAPH}/${userId}/threads`,
          form: { ...fields, access_token: token() },
        },
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
              url: `${GRAPH}/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(token())}`,
            },
            { status: 'FINISHED' }
          );
          const status = str(res.json, 'status');
          if (status === 'ERROR' || status === 'EXPIRED') {
            fail(`threads ${label} ${status}: ${str(res.json, 'error_message') ?? 'no detail'}`);
          }
          return { done: status === 'FINISHED', value: status };
        },
        `threads ${label} did not finish processing in time (container ${containerId})`
      );

    let containerId: string;
    if (media.length === 0) {
      containerId = await createContainer('create text container', {
        media_type: 'TEXT',
        text: input.text,
        ...aiLabel,
        ...replyTo,
        ...replyControl,
      });
    } else if (media.length === 1) {
      const [ref] = media;
      const isVideo = isVideoRef(ref);
      containerId = await createContainer(`create ${isVideo ? 'video' : 'image'} container`, {
        media_type: isVideo ? 'VIDEO' : 'IMAGE',
        [isVideo ? 'video_url' : 'image_url']: ref,
        ...(input.text.trim() ? { text: input.text } : {}),
        ...aiLabel,
        ...replyTo,
        ...replyControl,
      });
      await waitFinished(containerId, 'media container');
    } else {
      const children: string[] = [];
      for (const [index, ref] of media.entries()) {
        const isVideo = isVideoRef(ref);
        const childId = await createContainer(`create carousel item ${index + 1}`, {
          is_carousel_item: 'true',
          media_type: isVideo ? 'VIDEO' : 'IMAGE',
          [isVideo ? 'video_url' : 'image_url']: ref,
        });
        await waitFinished(childId, `carousel item ${index + 1}`);
        children.push(childId);
      }
      containerId = await createContainer('create carousel container', {
        media_type: 'CAROUSEL',
        children: children.join(','),
        ...(input.text.trim() ? { text: input.text } : {}),
        ...aiLabel,
        ...replyTo,
        ...replyControl,
      });
      await waitFinished(containerId, 'carousel container');
    }

    const published = await transport.send(
      {
        step: 'publish container',
        method: 'POST',
        url: `${GRAPH}/${userId}/threads_publish`,
        form: { creation_id: containerId, access_token: token() },
      },
      { id: '<threads post id>' }
    );
    const postId = requireId(str(published.json, 'id'), 'publish container');

    // Best effort: the publish already succeeded, so a failed permalink lookup is not an error.
    let url: string | undefined;
    try {
      const link = await transport.send(
        {
          step: 'look up permalink',
          method: 'GET',
          url: `${GRAPH}/${postId}?fields=permalink&access_token=${encodeURIComponent(token())}`,
        },
        { permalink: '<permalink>' }
      );
      url = str(link.json, 'permalink');
    } catch {
      url = undefined;
    }
    return { posted: true, platform: 'threads', postId, url };
  },
};
