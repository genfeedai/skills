import {
  bearer,
  fail,
  flag,
  type PostInput,
  type PostResult,
  type Publisher,
  type Transport,
} from '../core';

const DEFAULT_VERSION = '202505';

// POST https://api.linkedin.com/rest/posts — w_member_social token, versioned API.
export const linkedin: Publisher = {
  tokenEnv: ['LINKEDIN_ACCESS_TOKEN'],

  async publish(input: PostInput, transport: Transport): Promise<PostResult> {
    const author = flag(input, 'author', 'LINKEDIN_AUTHOR_URN');
    if (!author) fail('linkedin requires --author urn:li:person:<id> (or LINKEDIN_AUTHOR_URN)');
    const version = flag(input, 'linkedin-version', 'LINKEDIN_VERSION') || DEFAULT_VERSION;

    const res = await transport.send(
      {
        step: 'create post',
        method: 'POST',
        url: 'https://api.linkedin.com/rest/posts',
        headers: {
          ...bearer('LINKEDIN_ACCESS_TOKEN'),
          'content-type': 'application/json',
          'linkedin-version': version,
          'x-restli-protocol-version': '2.0.0',
        },
        json: {
          author,
          commentary: input.text,
          visibility: input.flags.visibility ?? 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        },
      },
      {}
    );
    const id = res.headers['x-restli-id'] ?? (transport.isDryRun ? '<post urn>' : undefined);
    return {
      posted: true,
      platform: 'linkedin',
      postId: id,
      url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined,
    };
  },
};
