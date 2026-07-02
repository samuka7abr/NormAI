/* ── File parsing Web Worker ─────────────────────────────────────
 * Runs entirely off the main thread so the UI never blocks while
 * reading CSV / XLSX files.
 * ─────────────────────────────────────────────────────────────── */

const PREVIEW_LIMIT = 10;

type ParseResult =
  | { columns: string[]; rows: string[][]; totalRows: number }
  | { error: string };

function normalizeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseCSV(text: string): { columns: string[]; rows: string[][]; totalRows: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 1) return { columns: [], rows: [], totalRows: 0 };

  // Detect delimiter: tab > semicolon > comma
  const sample = lines.slice(0, 5).join("\n");
  const sep = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : ",";

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        cells.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  const columns = parseLine(lines[0]);
  const dataLines = lines.slice(1);
  const rows = dataLines.slice(0, PREVIEW_LIMIT).map(parseLine);
  return { columns, rows, totalRows: dataLines.length };
}

self.addEventListener("message", async (e: MessageEvent<{ buffer: ArrayBuffer; name: string }>) => {
  const { buffer, name } = e.data;

  try {
    const nameLower = name.toLowerCase();

    if (nameLower.endsWith(".csv") || nameLower.endsWith(".tsv") || nameLower.endsWith(".txt")) {
      const text = new TextDecoder().decode(buffer);
      const result = parseCSV(text);
      (self as unknown as Worker).postMessage(result);
      return;
    }

    // XLSX / XLS — dynamic import keeps bundle size down for CSV-only users
    const { read, utils } = await import("xlsx");
    const wb = read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (raw.length < 1) {
      (self as unknown as Worker).postMessage({ columns: [], rows: [], totalRows: 0 } satisfies ParseResult);
      return;
    }

    const columns = (raw[0] as unknown[]).map(normalizeCell);
    const dataRows = raw.slice(1);
    const rows = dataRows.slice(0, PREVIEW_LIMIT).map((r) => (r as unknown[]).map(normalizeCell));
    (self as unknown as Worker).postMessage({ columns, rows, totalRows: dataRows.length } satisfies ParseResult);
  } catch (err) {
    (self as unknown as Worker).postMessage({ error: String(err) } satisfies ParseResult);
  }
});
