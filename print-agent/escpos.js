/**
 * Turns the print lines created by the web app (src/lib/printLayout.ts) into ESC/POS bytes.
 * Works with standard 80mm/58mm thermal printers (Epson TM-T82/T88, Xprinter, Rongta, etc.).
 *
 * Each line: { text, align?: 'left'|'center'|'right', bold?, big?, invert? }
 * Each page is followed by a feed and a partial cut.
 */
const ESC = 0x1b;
const GS = 0x1d;

const cmd = (...bytes) => Buffer.from(bytes);

/** Thermal printers use a single-byte code page. Replace characters they cannot print. */
export function toPrintable(text) {
  return String(text ?? '')
    .replace(/[·•]/g, '-')
    .replace(/[−–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '?');
}

export function encodePages(pages) {
  const out = [cmd(ESC, 0x40)]; // initialise printer
  for (const page of pages) {
    for (const line of page.lines) {
      out.push(cmd(ESC, 0x61, line.align === 'center' ? 1 : line.align === 'right' ? 2 : 0)); // align
      out.push(cmd(ESC, 0x45, line.bold ? 1 : 0)); // bold
      out.push(cmd(GS, 0x21, line.big ? 0x11 : 0x00)); // double width + height
      out.push(cmd(GS, 0x42, line.invert ? 1 : 0)); // white on black
      out.push(Buffer.from(toPrintable(line.text) + '\n', 'latin1'));
    }
    out.push(cmd(ESC, 0x45, 0), cmd(GS, 0x21, 0), cmd(GS, 0x42, 0), cmd(ESC, 0x61, 0));
    out.push(cmd(ESC, 0x64, 4)); // feed 4 lines so the cut does not slice text
    out.push(cmd(GS, 0x56, 66, 0)); // partial cut
  }
  return Buffer.concat(out);
}
