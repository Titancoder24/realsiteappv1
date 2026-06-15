import { createHash } from "crypto";

export function hashViewerPhone(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) throw new Error("Enter a valid phone number");
  return digits;
}
