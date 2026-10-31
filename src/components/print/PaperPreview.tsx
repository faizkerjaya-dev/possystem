import type { PrintLine } from '@/types/models';
import { charsPerLine } from '@/lib/printLayout';

/** Shows printer lines exactly as they will come out of the thermal printer (monospace, same width). */
export function PaperPreview({ lines, paperWidth = 80 }: { lines: PrintLine[]; paperWidth?: 80 | 58 }) {
  const chars = charsPerLine(paperWidth);
  return (
    <div
      className="shrink-0 bg-white px-3 py-4 font-mono text-[11px] leading-[1.5] text-black shadow-md"
      style={{ width: `calc(${chars}ch + 1.5rem)` }}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className={`whitespace-pre ${l.bold ? 'font-bold' : ''} ${l.big ? 'text-[22px] leading-[1.3]' : ''} ${
            l.invert ? 'bg-black px-1 text-white' : ''
          }`}
          style={{ textAlign: l.align ?? 'left' }}
        >
          {l.text || ' '}
        </div>
      ))}
    </div>
  );
}
