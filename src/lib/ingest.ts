/**
 * Client-side document ingestion: turn an uploaded File into plain text
 * that can be stored as a workspace document and auto-indexed.
 *
 * Runs entirely in the browser (PDF parsing via pdfjs-dist) so no server
 * filesystem / native binaries are needed.
 */

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".html",
  ".htm",
  ".log",
] as const;

export interface ParsedFile {
  title: string;
  text: string;
  fileType: string;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function baseName(name: string): string {
  const i = name.lastIndexOf(".");
  return (i > 0 ? name.slice(0, i) : name).trim() || name;
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((el) => el.remove());
  return (doc.body?.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Wire the worker bundle (Vite resolves the ?url import at build time).
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: buf });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    if (text) pages.push(text);
    page.cleanup();
  }
  await loadingTask.destroy();
  return pages.join("\n\n");
}

export function isAcceptedFile(file: File): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(extOf(file.name));
}

/** Parse a single uploaded file into storable text. Throws on unsupported/empty. */
export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = extOf(file.name);
  if (!isAcceptedFile(file)) {
    throw new Error(`Unsupported file type "${ext || file.name}"`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File is larger than 25 MB");
  }

  let text: string;
  let fileType: string;

  if (ext === ".pdf") {
    text = await parsePdf(file);
    fileType = "pdf";
  } else if (ext === ".html" || ext === ".htm") {
    text = stripHtml(await file.text());
    fileType = "html";
  } else {
    text = (await file.text()).replace(/\r\n/g, "\n").trim();
    fileType = ext.replace(".", "") || "text";
  }

  if (!text.trim()) {
    throw new Error("No extractable text found");
  }

  return { title: baseName(file.name), text, fileType };
}
