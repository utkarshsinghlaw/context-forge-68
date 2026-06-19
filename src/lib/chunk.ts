/** Split text into overlapping chunks for embedding. Pure, no I/O. */
export function chunkText(text: string, target = 1100, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];

  // Prefer splitting on paragraph / sentence boundaries.
  const paragraphs = clean.split(/\n{2,}/);
  const pieces: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length > target && buf) {
      pieces.push(buf.trim());
      // start next buffer with a small overlap tail
      buf = buf.slice(Math.max(0, buf.length - overlap)) + "\n\n" + p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf.trim()) pieces.push(buf.trim());

  // Hard-split any oversized piece.
  const out: string[] = [];
  for (const piece of pieces) {
    if (piece.length <= target * 1.5) {
      out.push(piece);
      continue;
    }
    for (let i = 0; i < piece.length; i += target - overlap) {
      out.push(piece.slice(i, i + target));
    }
  }
  return out.filter((c) => c.trim().length > 0);
}