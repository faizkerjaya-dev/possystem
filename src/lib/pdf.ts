import type { PrintLine } from '@/types/models';
import { charsPerLine } from './printLayout';

/**
 * Saves KOT/receipt pages as an 80mm (or 58mm) PDF using the same lines as the printer.
 * jsPDF is loaded only when needed to keep the app fast.
 */
export async function savePagesAsPdf(pages: { lines: PrintLine[] }[], fileName: string, paperWidth: 80 | 58) {
  const { jsPDF } = await import('jspdf');
  const margin = 4; // mm
  const printable = paperWidth - margin * 2;
  const chars = charsPerLine(paperWidth);
  const fontSize = (printable / chars / 0.6) * 2.835; // courier char width ≈ 0.6 em; 1mm = 2.835pt
  const lineH = (fontSize / 2.835) * 1.35;

  const heights = pages.map((p) => margin * 2 + p.lines.reduce((h, l) => h + (l.big ? lineH * 1.6 : lineH), 0));
  const doc = new jsPDF({ unit: 'mm', format: [paperWidth, Math.max(...heights, 40)] });

  pages.forEach((page, pi) => {
    if (pi > 0) doc.addPage([paperWidth, heights[pi]]);
    let y = margin;
    for (const l of page.lines) {
      const size = l.big ? fontSize * 1.5 : fontSize;
      const h = l.big ? lineH * 1.6 : lineH;
      doc.setFont('courier', l.bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      if (l.invert) {
        doc.setFillColor(0, 0, 0);
        doc.rect(margin, y, printable, h, 'F');
        doc.setTextColor(255, 255, 255);
      } else doc.setTextColor(0, 0, 0);
      const x = l.align === 'center' ? paperWidth / 2 : l.align === 'right' ? paperWidth - margin : margin;
      doc.text(l.text, x, y + h * 0.75, { align: l.align ?? 'left' });
      y += h;
    }
  });
  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}
