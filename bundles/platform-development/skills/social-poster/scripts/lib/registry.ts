import type { Platform, Publisher } from './core';
import { facebook } from './platforms/facebook';
import { instagram } from './platforms/instagram';
import { linkedin } from './platforms/linkedin';
import { mastodon } from './platforms/mastodon';
import { pinterest } from './platforms/pinterest';
import { threads } from './platforms/threads';
import { tiktok } from './platforms/tiktok';
import { x } from './platforms/x';
import { youtube } from './platforms/youtube';

export const PUBLISHERS: Record<Platform, Publisher> = {
  x,
  linkedin,
  threads,
  instagram,
  facebook,
  tiktok,
  youtube,
  pinterest,
  mastodon,
};

export function isPlatform(value: string | undefined): value is Platform {
  return value !== undefined && Object.hasOwn(PUBLISHERS, value);
}
