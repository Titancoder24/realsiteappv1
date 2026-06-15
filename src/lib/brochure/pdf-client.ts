"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsModule: typeof import("pdfjs-dist") | null = null;

export async function getPdfjs() {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist");
    pdfjsModule.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjsModule;
}

export async function loadPdfDocument(url: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({
    url,
    cMapUrl: "https://unpkg.com/pdfjs-dist@4.10.38/cmaps/",
    cMapPacked: true,
    withCredentials: false,
  });
  return task.promise;
}

export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");

  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

  await page.render({ canvasContext: context, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: buffer });
  const doc = await task.promise;
  const count = doc.numPages;
  await doc.destroy();
  return count;
}
