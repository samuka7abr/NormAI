"use client";

export type ParseResult = { columns: string[]; rows: string[][]; totalRows: number };

/** Parses a CSV or XLSX file in a Web Worker so the main thread stays free. */
export function parseFileInWorker(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./parse-worker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent<ParseResult & { error?: string }>) => {
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    // Read the file as ArrayBuffer on the main thread (non-blocking I/O),
    // then transfer it to the worker (zero-copy).
    file.arrayBuffer()
      .then((buffer) => {
        worker.postMessage({ buffer, name: file.name }, [buffer]);
      })
      .catch(reject);
  });
}
