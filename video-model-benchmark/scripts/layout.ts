// Pure geometry and text helpers for the side-by-side canvas. No I/O, so it is easy to reason about.

export type CanvasName = 'square' | 'landscape';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PromptBox {
  x: number;
  y: number;
  /** Wrap width in pixels. */
  w: number;
  fontSize: number;
  maxLines: number;
}

export interface CanvasLayout {
  width: number;
  height: number;
  panels: Rect[];
  prompt: PromptBox;
  labelFontSize: number;
  labelBandHeight: number;
  /** Where the optional footer text sits. */
  footer: { x: string; y: number; fontSize: number };
}

const SIZES: Record<CanvasName, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

const even = (n: number): number => Math.floor(n / 2) * 2;

/** Largest even-sized 9:16 panel that fits `availW` x `availH`. */
function fitPanel(availW: number, availH: number): { w: number; h: number } {
  const h = even(Math.min(availH, (availW * 16) / 9));
  return { w: even((h * 9) / 16), h };
}

export function buildLayout(canvas: CanvasName, panelCount: number): CanvasLayout {
  const { width, height } = SIZES[canvas];
  const margin = canvas === 'square' ? 16 : 40;
  const gap = canvas === 'square' ? 12 : 16;
  const isColumnLayout = canvas === 'landscape' && panelCount <= 2;

  if (isColumnLayout) {
    // Prompt column on the left, panels filling the full height on the right.
    const panel = fitPanel(
      (width * 0.6 - gap * (panelCount - 1)) / panelCount,
      height - margin * 2
    );
    const panelsWidth = panel.w * panelCount + gap * (panelCount - 1);
    const panelsX = width - margin - panelsWidth;
    const panels = Array.from({ length: panelCount }, (_, i) => ({
      x: panelsX + i * (panel.w + gap),
      y: Math.floor((height - panel.h) / 2),
      w: panel.w,
      h: panel.h,
    }));
    const columnW = panelsX - margin * 2;
    return {
      width,
      height,
      panels,
      prompt: {
        x: margin + 8,
        y: Math.floor(height / 2) - 150,
        w: columnW - 8,
        fontSize: 44,
        maxLines: 9,
      },
      labelFontSize: 34,
      labelBandHeight: 76,
      footer: { x: String(margin + 8), y: height - margin - 36, fontSize: 28 },
    };
  }

  // Header layout: prompt on top, panels centred underneath.
  const headerH = canvas === 'square' ? 176 : 150;
  const availH = height - headerH - margin;
  const panel = fitPanel((width - margin * 2 - gap * (panelCount - 1)) / panelCount, availH);
  const panelsWidth = panel.w * panelCount + gap * (panelCount - 1);
  const panelsX = Math.floor((width - panelsWidth) / 2);
  const panelsY = headerH + Math.floor((availH - panel.h) / 2);
  const panels = Array.from({ length: panelCount }, (_, i) => ({
    x: panelsX + i * (panel.w + gap),
    y: panelsY,
    w: panel.w,
    h: panel.h,
  }));
  const fontSize = canvas === 'square' ? 28 : 34;
  return {
    width,
    height,
    panels,
    prompt: {
      x: margin + 8,
      y: 44,
      w: width - (margin + 8) * 2,
      fontSize,
      maxLines: canvas === 'square' ? 3 : 2,
    },
    labelFontSize: canvas === 'square' ? 30 : 32,
    labelBandHeight: canvas === 'square' ? 64 : 68,
    // Top right, clear of the panels: the bottom edge belongs to the video.
    footer: { x: `${width - margin - 8}-text_w`, y: 14, fontSize: 22 },
  };
}

/** Greedy word wrap using an average glyph width of 0.55em. Truncates with an ellipsis past `maxLines`. */
export function wrapText(
  text: string,
  widthPx: number,
  fontSize: number,
  maxLines: number
): string {
  const maxChars = Math.max(8, Math.floor(widthPx / (fontSize * 0.55)));
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines.join('\n');
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return kept.join('\n');
}
