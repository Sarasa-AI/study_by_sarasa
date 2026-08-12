/// <reference types="node" />

/**
 * Ambient module declaration for pdf-parse's internal implementation file.
 *
 * We import from "pdf-parse/lib/pdf-parse.js" instead of the package root
 * ("pdf-parse") because the package root's index.js runs a debug-mode
 * side effect (`!module.parent` check) that reads/writes a test fixture PDF
 * on import. That check is unreliable inside bundled Next.js server code and
 * can throw on read-only serverless filesystems. The lib file exports the
 * same parsing function without that side effect.
 */
declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseVersion = "default" | "v1.9.426" | "v1.10.100" | "v1.10.88" | "v2.0.550";

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: unknown;
    metadata: unknown;
    version: PdfParseVersion;
    text: string;
  }

  interface PdfParseOptions {
    pagerender?: ((pageData: unknown) => string | Promise<string>) | undefined;
    max?: number | undefined;
    version?: PdfParseVersion | undefined;
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;

  export = pdfParse;
}
