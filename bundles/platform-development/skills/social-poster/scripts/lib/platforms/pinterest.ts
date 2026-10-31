import {
  bearer,
  fail,
  hasFlag,
  type PostInput,
  type PostResult,
  type Publisher,
  requireFlag,
  requireId,
  requireUrls,
  str,
  type Transport,
} from '../core';

// Pinterest API v5: POST /v5/pins with an image URL media source.
// Field limits and media_source shapes are from Pinterest's published OpenAPI description.
export const pinterest: Publisher = {
  tokenEnv: ['PINTEREST_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const boardId = requireFlag(input, 'account', 'PINTEREST_BOARD_ID', 'Pinterest board id');
    const media = requireUrls('pinterest', input.media);
    if (media.length === 0) fail('pinterest needs --media (a public https image URL)');
    if (media.length > 5) fail('pinterest carousel pins hold 2 to 5 images');
    const title = input.flags.title ?? '';
    if ([...title].length > 100) fail('pinterest title is limited to 100 characters');
    if ([...input.text].length > 800) fail('pinterest description is limited to 800 characters');
    const alt = input.flags.alt ?? '';
    if ([...alt].length > 500) fail('pinterest alt text is limited to 500 characters');

    const mediaSource =
      media.length === 1
        ? { source_type: 'image_url', url: media[0] }
        : { source_type: 'multiple_image_urls', items: media.map((url) => ({ url })) };

    const res = await transport.send(
      {
        step: 'create pin',
        method: 'POST',
        url: 'https://api.pinterest.com/v5/pins',
        headers: { ...bearer('PINTEREST_ACCESS_TOKEN'), 'content-type': 'application/json' },
        json: {
          board_id: boardId,
          media_source: mediaSource,
          ...(title ? { title } : {}),
          ...(input.text.trim() ? { description: input.text } : {}),
          ...(input.flags.link ? { link: input.flags.link } : {}),
          ...(alt ? { alt_text: alt } : {}),
          ...(hasFlag(input, 'ai-generated')
            ? { ai_disclosures: { values: ['AI_MODIFIED'] } }
            : {}),
        },
      },
      { id: '<pin id>' }
    );
    const id = requireId(str(res.json, 'id'), 'create pin');
    return {
      posted: true,
      platform: 'pinterest',
      postId: id,
      url: `https://www.pinterest.com/pin/${id}/`,
    };
  },
};
