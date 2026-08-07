import path from 'node:path';
import type { SourceBlock } from './chunk';

export interface ParsedDocument {
  blocks: SourceBlock[];
  pageCount?: number;
}

export const SUPPORTED_EXTENSIONS = [
  '.txt',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.log',
  '.pdf',
  '.docx',
  '.xlsx',
];

export function isSupported(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(path.extname(fileName).toLowerCase());
}

/**
 * Parse bytes into blocks tagged with page/section metadata. Format-specific
 * parsers are loaded lazily so a missing optional dependency only breaks the
 * one format that needs it.
 */
export async function parseDocument(
  fileName: string,
  buffer: Buffer,
): Promise<ParsedDocument> {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf':
      return parsePdf(buffer);
    case '.docx':
      return parseDocx(buffer);
    case '.xlsx':
      return parseXlsx(buffer);
    case '.csv':
    case '.tsv':
      return parseDelimited(buffer, ext === '.tsv' ? '\t' : ',');
    case '.json':
      return parseJson(buffer);
    case '.md':
    case '.markdown':
      return parseMarkdown(buffer.toString('utf8'));
    case '.txt':
    case '.log':
      return { blocks: splitParagraphs(buffer.toString('utf8')) };
    default:
      throw new Error(`Unsupported file type "${ext || fileName}"`);
  }
}

/** Markdown: headings become the `section` label for everything beneath them. */
export function parseMarkdown(text: string): ParsedDocument {
  const blocks: SourceBlock[] = [];
  let section: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join('\n').trim();
    if (joined) blocks.push({ text: joined, section });
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      section = heading[2].trim();
      // Keep the heading in the body so it is searchable too.
      buffer.push(line.trim());
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return { blocks };
}

function splitParagraphs(text: string): SourceBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => ({ text: t }));
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // pdfjs ships a legacy CJS build that runs fine under Node.
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const blocks: SourceBlock[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string') continue;
      text += item.str;
      // pdfjs marks a visual line break with hasEOL.
      text += item.hasEOL ? '\n' : ' ';
    }
    const cleaned = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!cleaned) continue;
    for (const para of cleaned.split(/\n\s*\n/)) {
      const t = para.trim();
      if (t) blocks.push({ text: t, page: pageNo });
    }
    page.cleanup();
  }
  const pageCount = doc.numPages;
  await doc.destroy();
  return { blocks, pageCount };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth: any = await import('mammoth');
  // Markdown output preserves headings, which become section labels.
  const result = await (mammoth.convertToMarkdown ?? mammoth.default.convertToMarkdown)({
    buffer,
  });
  // mammoth escapes markdown punctuation ("retries\."); those backslashes
  // would otherwise show up verbatim in quoted answers and citations.
  const text = (result.value ?? '').replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1');
  return parseMarkdown(text);
}

async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  let ExcelJS: any;
  try {
    ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'));
  } catch {
    throw new Error('.xlsx support needs the optional "exceljs" package (npm i exceljs)');
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const blocks: SourceBlock[] = [];
  wb.eachSheet((sheet: any) => {
    const rows: string[] = [];
    sheet.eachRow((row: any) => {
      const values = (row.values as any[]).slice(1).map(cellToText);
      if (values.some((v) => v.length)) rows.push(values.join(' | '));
    });
    // One block per ~40 rows keeps a wide sheet from becoming one giant chunk.
    for (let i = 0; i < rows.length; i += 40) {
      const slice = rows.slice(i, i + 40);
      if (slice.length) blocks.push({ text: slice.join('\n'), section: sheet.name });
    }
  });
  return { blocks };
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as any;
    if (typeof v.text === 'string') return v.text;
    if (typeof v.result !== 'undefined') return String(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text).join('');
    return '';
  }
  return String(value);
}

/**
 * CSV/TSV: repeat the header on every block so a retrieved row still says
 * which column is which.
 */
function parseDelimited(buffer: Buffer, delimiter: string): ParsedDocument {
  const lines = buffer
    .toString('utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (!lines.length) return { blocks: [] };

  const header = lines[0];
  const blocks: SourceBlock[] = [];
  const rowsPerBlock = 30;
  for (let i = 1; i < lines.length; i += rowsPerBlock) {
    const slice = lines.slice(i, i + rowsPerBlock);
    blocks.push({
      text: [header, ...slice].join('\n'),
      section: `rows ${i}-${Math.min(i + rowsPerBlock - 1, lines.length - 1)}`,
    });
  }
  if (!blocks.length) blocks.push({ text: header });
  void delimiter; // header is repeated verbatim; no field parsing needed
  return { blocks };
}

function parseJson(buffer: Buffer): ParsedDocument {
  const raw = buffer.toString('utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { blocks: splitParagraphs(raw) };
  }
  // An array of records chunks far better as one block per record.
  if (Array.isArray(parsed)) {
    const blocks: SourceBlock[] = [];
    const perBlock = 20;
    for (let i = 0; i < parsed.length; i += perBlock) {
      blocks.push({
        text: JSON.stringify(parsed.slice(i, i + perBlock), null, 2),
        section: `items ${i}-${Math.min(i + perBlock - 1, parsed.length - 1)}`,
      });
    }
    return { blocks };
  }
  if (parsed && typeof parsed === 'object') {
    return {
      blocks: Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
        text: `${key}: ${JSON.stringify(value, null, 2)}`,
        section: key,
      })),
    };
  }
  return { blocks: [{ text: raw }] };
}
