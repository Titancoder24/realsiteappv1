export async function countPdfPages(buffer: ArrayBuffer): Promise<number> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: buffer, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
  const doc = await task.promise;
  const count = doc.numPages;
  await doc.destroy();
  return count;
}
