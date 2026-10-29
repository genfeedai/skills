// Video model registry for video-model-benchmark.
//
// Aliases and Replicate ids mirror Genfeed's own video model registry
// (genfeed.ai packages/workflows/src/ui/lib/models/registry.ts), so a clip made here is the
// same model a Genfeed render would call. Input shapes were read from each model's published
// Replicate OpenAPI schema; pass --model-input <alias>='{...}' to override anything.

export interface VideoModelSpec {
  alias: string;
  label: string;
  replicateId: string;
  /** Upper bound in USD per second of output at the default resolution, null when not verified. */
  maxUsdPerSecond: number | null;
  /** Durations the model accepts, null when any positive integer is accepted. */
  durations: number[] | null;
  resolutions: string[] | null;
  supportsAudio: boolean;
  /** How aspect ratio is sent: the usual `aspect_ratio` field. */
  buildInput: (options: ModelRunOptions) => Record<string, unknown>;
}

export interface ModelRunOptions {
  prompt: string;
  /** `9:16` for the portrait canvases, `16:9` for the stacked one. */
  aspectRatio: string;
  durationSeconds: number;
  resolution: string | null;
  isAudioEnabled: boolean;
}

function nearestDuration(allowed: number[] | null, wanted: number): number {
  if (!allowed) return wanted;
  return allowed.reduce((best, d) => (Math.abs(d - wanted) < Math.abs(best - wanted) ? d : best));
}

function veoInput(spec: { durations: number[] }) {
  return (o: ModelRunOptions): Record<string, unknown> => ({
    prompt: o.prompt,
    aspect_ratio: o.aspectRatio,
    duration: nearestDuration(spec.durations, o.durationSeconds),
    resolution: o.resolution ?? '720p',
    generate_audio: o.isAudioEnabled,
  });
}

function seedanceInput(o: ModelRunOptions): Record<string, unknown> {
  return {
    prompt: o.prompt,
    aspect_ratio: o.aspectRatio,
    duration: o.durationSeconds,
    resolution: o.resolution ?? '720p',
    generate_audio: o.isAudioEnabled,
  };
}

export const VIDEO_MODELS: VideoModelSpec[] = [
  {
    alias: 'veo-3.1-fast',
    label: 'Veo 3.1 Fast',
    replicateId: 'google/veo-3.1-fast',
    maxUsdPerSecond: 0.15,
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    buildInput: veoInput({ durations: [4, 6, 8] }),
  },
  {
    alias: 'veo-3.1',
    label: 'Veo 3.1',
    replicateId: 'google/veo-3.1',
    maxUsdPerSecond: 0.4,
    durations: [4, 6, 8],
    resolutions: ['720p', '1080p'],
    supportsAudio: true,
    buildInput: veoInput({ durations: [4, 6, 8] }),
  },
  {
    alias: 'seedance-2.0-fast',
    label: 'Seedance 2.0 Fast',
    replicateId: 'bytedance/seedance-2.0-fast',
    maxUsdPerSecond: 0.17,
    durations: null,
    resolutions: ['480p', '720p'],
    supportsAudio: true,
    buildInput: seedanceInput,
  },
  {
    alias: 'seedance-2.0',
    label: 'Seedance 2.0',
    replicateId: 'bytedance/seedance-2.0',
    maxUsdPerSecond: null,
    durations: null,
    resolutions: ['480p', '720p', '1080p', '4k'],
    supportsAudio: true,
    buildInput: seedanceInput,
  },
  {
    alias: 'seedance-2.5',
    label: 'Seedance 2.5',
    replicateId: 'bytedance/seedance-2.5',
    maxUsdPerSecond: 0.9676,
    durations: null,
    resolutions: ['480p', '720p'],
    supportsAudio: true,
    buildInput: seedanceInput,
  },
  {
    alias: 'kling-v2.5-turbo-pro',
    label: 'Kling 2.5 Turbo Pro',
    replicateId: 'kwaivgi/kling-v2.5-turbo-pro',
    maxUsdPerSecond: 0.07,
    durations: [5, 10],
    resolutions: null,
    supportsAudio: false,
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: nearestDuration([5, 10], o.durationSeconds),
    }),
  },
];

/** The default pair: both are in Genfeed's registry, both cheap, both current. */
export const DEFAULT_MODELS = ['veo-3.1-fast', 'seedance-2.0-fast'];

export function findModel(alias: string): VideoModelSpec | undefined {
  return VIDEO_MODELS.find((m) => m.alias === alias || m.replicateId === alias);
}

/** A raw `owner/name` Replicate id that is not in the registry: label it by its name, send the common fields. */
export function rawModel(replicateId: string): VideoModelSpec {
  const name = replicateId.split('/').pop()?.split(':')[0] ?? replicateId;
  return {
    alias: name,
    label: name,
    replicateId,
    maxUsdPerSecond: null,
    durations: null,
    resolutions: null,
    supportsAudio: false,
    buildInput: (o) => ({
      prompt: o.prompt,
      aspect_ratio: o.aspectRatio,
      duration: o.durationSeconds,
    }),
  };
}
