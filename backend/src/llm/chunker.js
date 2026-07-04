const DEFAULT_CHUNK_SIZE = 6000;
const DEFAULT_OVERLAP = 500;

export function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  if (!text || text.length <= chunkSize) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    if (end < text.length) {
      const breakAt = text.lastIndexOf('. ', end);
      if (breakAt > start + chunkSize * 0.5) {
        end = breakAt + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks.filter((c) => c.length > 50);
}