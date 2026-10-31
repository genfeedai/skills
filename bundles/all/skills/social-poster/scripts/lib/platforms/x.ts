import {
  bearer,
  type PostInput,
  type PostResult,
  type Publisher,
  requireId,
  str,
  type Transport,
} from '../core';

// POST https://api.x.com/2/tweets — OAuth 2.0 user-context token with tweet.write.
// Media upload is a separate multi-step flow; this takes already-uploaded media ids.
export const x: Publisher = {
  tokenEnv: ['X_BEARER_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const body: Record<string, unknown> = { text: input.text };
    if (input.mediaIds.length) body.media = { media_ids: input.mediaIds };
    const replyTo = input.flags['reply-to'];
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };

    const res = await transport.send(
      {
        step: 'create tweet',
        method: 'POST',
        url: 'https://api.x.com/2/tweets',
        headers: { ...bearer('X_BEARER_TOKEN'), 'content-type': 'application/json' },
        json: body,
      },
      { data: { id: '<tweet id>' } }
    );
    const id = requireId(str(res.json, 'data', 'id'), 'create tweet');
    return { posted: true, platform: 'x', postId: id, url: `https://x.com/i/web/status/${id}` };
  },
};
