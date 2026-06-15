import { createAdminClient } from "@/lib/supabase/admin";
import { isPdfFile } from "@/lib/brochure/pdf-utils";
import { worldLabsService } from "./world-labs.service";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg", "video/mp4", "video/quicktime", "application/pdf", "application/x-pdf", "application/octet-stream"];

export function validateMediaFile(file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  if (isPdfFile(file)) return;
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`Unsupported type: ${file.type}`);
}

function assetTypeFor(contentType: string) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType === "application/pdf" || contentType === "application/x-pdf") return "document";
  return "video";
}

export class MediaService {
  async uploadBufferToStorage(params: {
    buffer: ArrayBuffer;
    fileName: string;
    contentType: string;
    organizationId: string;
    propertyId?: string;
    folder?: string;
  }) {
    if (params.buffer.byteLength > MAX_FILE_SIZE) {
      throw new Error(`File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    const admin = createAdminClient();
    const ext = params.fileName.split(".").pop() ?? "bin";
    const base = params.folder
      ? `${params.organizationId}/${params.propertyId ?? "general"}/${params.folder}`
      : `${params.organizationId}/${params.propertyId ?? "general"}`;
    const path = `${base}/${Date.now()}.${ext}`;
    const contentType = params.contentType || "application/octet-stream";

    const { error: uploadError } = await admin.storage.from("media").upload(path, params.buffer, {
      contentType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = admin.storage.from("media").getPublicUrl(path);
    return this.insertAsset({
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      fileName: params.fileName,
      fileUrl: publicUrl,
      contentType,
      fileSize: params.buffer.byteLength,
    });
  }

  async registerStoredFile(params: {
    organizationId: string;
    propertyId?: string;
    fileName: string;
    fileUrl: string;
    contentType: string;
    fileSize?: number;
  }) {
    return this.insertAsset(params);
  }

  private async insertAsset(params: {
    organizationId: string;
    propertyId?: string;
    fileName: string;
    fileUrl: string;
    contentType: string;
    fileSize?: number;
  }) {
    const admin = createAdminClient();
    const { data: asset, error } = await admin.from("media_assets").insert({
      organization_id: params.organizationId,
      property_id: params.propertyId,
      file_name: params.fileName,
      file_url: params.fileUrl,
      content_type: params.contentType,
      file_size: params.fileSize ?? null,
      asset_type: assetTypeFor(params.contentType),
      metadata: { thumbnail_url: params.contentType.startsWith("image/") ? params.fileUrl : null },
    }).select().single();

    if (error) throw error;
    return asset;
  }

  async uploadToStorage(file: File, organizationId: string, propertyId?: string) {
    validateMediaFile(file);
    const buffer = await file.arrayBuffer();
    return this.uploadBufferToStorage({
      buffer,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      organizationId,
      propertyId,
    });
  }

  async uploadToWorldLabs(file: File, organizationId: string, propertyId?: string) {
    const asset = await this.uploadToStorage(file, organizationId, propertyId);
    try {
      const prepared = await worldLabsService.prepareMediaUpload(file.name, file.type);
      const buffer = await file.arrayBuffer();
      await worldLabsService.uploadToSignedUrl(prepared.upload_url, buffer, file.type, prepared.upload_headers);
      const admin = createAdminClient();
      await admin.from("media_assets").update({ worldlabs_media_asset_id: prepared.media_asset_id }).eq("id", asset.id);
      return { ...asset, worldlabs_media_asset_id: prepared.media_asset_id };
    } catch (err) {
      const admin = createAdminClient();
      await admin.from("media_assets").update({ metadata: { worldlabs_upload_error: err instanceof Error ? err.message : "upload failed" } }).eq("id", asset.id);
      throw new Error(`World Labs media upload failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
}

export const mediaService = new MediaService();
