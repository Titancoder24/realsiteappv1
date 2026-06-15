export function isPdfFile(file: Pick<File, "name" | "type">) {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf"
    || file.type === "application/x-pdf"
    || name.endsWith(".pdf");
}

export function pdfContentType(file: Pick<File, "name" | "type">) {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return "application/pdf";
}
