/**
 * Heading- and page-aware chunking. Splits on structure first, then packs
 * blocks up to a token budget with overlap, so a chunk rarely straddles two
 * unrelated sections.
 */

/** A parsed document arrives as blocks, each knowing where it came from. */
export interface SourceBlock {
  text: string;
  page?: number;
  section?: string;
}

export interface Chunk {
  text: string;
  page?: number;
  section?: string;
  index: number;
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
  /**
   * Break at a heading once a chunk is at least this fraction of target.
   * Without it, a short document becomes one chunk covering every section and
   * citations can only ever name the file. Set to 0 to pack purely by size.
   */
  sectionBreakRatio?: number;
}

/** Cheap token estimate. ~4 chars/token holds well enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkBlocks(blocks: SourceBlock[], opts: ChunkOptions = {}): Chunk[] {
  const targetTokens = opts.targetTokens ?? 900;
  const overlapTokens = opts.overlapTokens ?? 100;
  const targetChars = targetTokens * 4;
  const overlapChars = overlapTokens * 4;

  // Blocks longer than the budget get hard-split before packing.
  const units: SourceBlock[] = [];
  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;
    if (text.length <= targetChars) {
      units.push({ ...block, text });
      continue;
    }
    for (const piece of splitLong(text, targetChars)) {
      units.push({ ...block, text: piece });
    }
  }

  const chunks: Chunk[] = [];
  let buffer: SourceBlock[] = [];
  let bufferChars = 0;

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.map((b) => b.text).join('\n\n').trim();
    if (!text) return;
    chunks.push({
      text,
      page: buffer[0].page,
      // A chunk can span several headings; naming only the first would make
      // the citation point at the wrong part of the document.
      section: sectionLabel(buffer),
      index: chunks.length,
    });
  };

  const sectionBreakAt = (opts.sectionBreakRatio ?? 0.4) * targetChars;

  for (const unit of units) {
    const unitChars = unit.text.length + 2;

    // A heading boundary is a real semantic break, so split there rather than
    // carrying overlap across it — the chunk gets one honest section label.
    const startsNewSection =
      sectionBreakAt > 0 &&
      buffer.length > 0 &&
      unit.section !== undefined &&
      unit.section !== buffer[buffer.length - 1].section &&
      bufferChars >= sectionBreakAt;

    if (startsNewSection) {
      flush();
      buffer = [];
      bufferChars = 0;
    } else if (bufferChars + unitChars > targetChars && buffer.length) {
      flush();
      // Carry the tail of the previous chunk forward so a sentence split
      // across the boundary is still retrievable from both sides.
      const carry: SourceBlock[] = [];
      let carried = 0;
      for (let i = buffer.length - 1; i >= 0 && carried < overlapChars; i--) {
        carry.unshift(buffer[i]);
        carried += buffer[i].text.length;
      }
      buffer = carry;
      bufferChars = carried;
    }
    buffer.push(unit);
    bufferChars += unitChars;
  }
  flush();

  // A section break can leave a stub at the end (e.g. a two-line "Known gaps").
  // Very short texts embed erratically, so fold it back into its predecessor.
  const last = chunks[chunks.length - 1];
  if (chunks.length > 1 && last.text.length < targetChars * 0.15) {
    const previous = chunks[chunks.length - 2];
    if (previous.text.length + last.text.length <= targetChars * 1.2) {
      previous.text = `${previous.text}\n\n${last.text}`;
      if (previous.section && last.section && previous.section !== last.section) {
        previous.section = `${previous.section.split(' → ')[0]} → ${last.section}`;
      }
      chunks.pop();
    }
  }

  return chunks;
}

/** "Risks" for a single section, "Decisions → Risks" when a chunk spans several. */
function sectionLabel(blocks: SourceBlock[]): string | undefined {
  const sections: string[] = [];
  for (const block of blocks) {
    if (block.section && block.section !== sections[sections.length - 1]) {
      sections.push(block.section);
    }
  }
  if (!sections.length) return undefined;
  if (sections.length === 1) return sections[0];
  return `${sections[0]} → ${sections[sections.length - 1]}`;
}

/** Split an oversized block on sentence boundaries, falling back to hard cuts. */
function splitLong(text: string, maxChars: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\n/);
  const out: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        out.push(current);
        current = '';
      }
      for (let i = 0; i < sentence.length; i += maxChars) {
        out.push(sentence.slice(i, i + maxChars));
      }
      continue;
    }
    if (current.length + sentence.length + 1 > maxChars) {
      out.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) out.push(current);
  return out.filter((s) => s.trim().length > 0);
}
