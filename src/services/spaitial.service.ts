import { requireServerKey } from "@/lib/env";

const BASE = "https://api.spaitial.ai";

export interface SpAItialWorldResult {
  requestId: string;
  worldId?: string;
  title?: string;
  splatProxyUrl?: string;
  splatFormat?: string;
  thumbnailUrl?: string;
  panoramaProxyUrl?: string;
  viewerUrl?: string;
}

export interface SpAItialStatus {
  requestId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress?: number;
  error?: string;
}

function authHeaders(extra?: Record<string, string>) {
  const key = requireServerKey("SPAITIAL_API_KEY", "SpAItial API key");
  return { Authorization: `Bearer ${key}`, ...extra };
}

async function parseError(res: Response) {
  const body = await res.json().catch(() => ({}));
  const msg = (body as { error?: { message?: string } }).error?.message ?? res.statusText;
  throw new Error(msg || `SpAItial API error ${res.status}`);
}

export class SpAItialService {
  async listModels() {
    const res = await fetch(`${BASE}/v1/models`, { headers: authHeaders() });
    if (!res.ok) await parseError(res);
    return res.json();
  }

  /** Upload image buffer — returns file_id (24h TTL). */
  async uploadFile(buffer: ArrayBuffer, filename: string, mimeType: string): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: mimeType }), filename);
    const res = await fetch(`${BASE}/v1/files`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { file_id: string };
    return data.file_id;
  }

  /** Create world from a public HTTPS image URL (simplest path). */
  async createWorldFromImageUrl(params: {
    imageUrl: string;
    title?: string;
    prompt?: string;
    model?: string;
    isPano?: boolean;
  }): Promise<{ requestId: string; status: string }> {
    const body: Record<string, unknown> = {
      input: {
        type: "url",
        image_url: params.imageUrl,
        ...(params.isPano ? { is_pano: true } : {}),
      },
      model: params.model ?? "default",
      title: params.title ?? "Property immersive world",
      output_format: "spz",
      validation: { skip: true },
      visibility: { is_public: false, is_listed: false },
    };
    const res = await fetch(`${BASE}/v1/worlds`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { request_id: string; status: string };
    return { requestId: data.request_id, status: data.status };
  }

  async createWorldFromText(params: {
    prompt: string;
    title?: string;
    model?: string;
  }): Promise<{ requestId: string; status: string }> {
    const res = await fetch(`${BASE}/v1/worlds`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        input: { type: "text", prompt: params.prompt },
        model: params.model ?? "default",
        title: params.title ?? params.prompt.slice(0, 80),
        output_format: "spz",
        visibility: { is_public: false, is_listed: false },
      }),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { request_id: string; status: string };
    return { requestId: data.request_id, status: data.status };
  }

  async createWorldFromFileId(params: {
    fileId: string;
    title?: string;
    model?: string;
    isPano?: boolean;
  }): Promise<{ requestId: string; status: string }> {
    const res = await fetch(`${BASE}/v1/worlds`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        input: { type: "file_id", file_id: params.fileId, ...(params.isPano ? { is_pano: true } : {}) },
        model: params.model ?? "default",
        title: params.title ?? "Property immersive world",
        output_format: "spz",
        validation: { skip: true },
        visibility: { is_public: false, is_listed: false },
      }),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as { request_id: string; status: string };
    return { requestId: data.request_id, status: data.status };
  }

  async getStatus(requestId: string): Promise<SpAItialStatus> {
    const res = await fetch(`${BASE}/v1/worlds/requests/${requestId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as {
      request_id: string;
      status: SpAItialStatus["status"];
      progress?: number;
      error?: { message?: string } | string;
    };
    const errMsg = typeof data.error === "string" ? data.error : data.error?.message;
    return {
      requestId: data.request_id,
      status: data.status,
      progress: data.progress,
      error: errMsg,
    };
  }

  async getResult(requestId: string): Promise<SpAItialWorldResult> {
    const res = await fetch(`${BASE}/v1/worlds/requests/${requestId}/result`, {
      headers: authHeaders(),
    });
    if (!res.ok) await parseError(res);
    const data = (await res.json()) as {
      request_id: string;
      world?: {
        id?: string;
        title?: string;
        splat_url?: string;
        splat_format?: string;
        thumbnail_url?: string;
        panorama_url?: string;
        viewer_url?: string;
      };
      splat_url?: string;
      thumbnail_url?: string;
      panorama_url?: string;
      viewer_url?: string;
      world_id?: string;
      title?: string;
    };
    const w = data.world;
    return {
      requestId: data.request_id,
      worldId: w?.id ?? data.world_id,
      title: w?.title ?? data.title,
      splatProxyUrl: w?.splat_url ?? data.splat_url,
      splatFormat: w?.splat_format,
      thumbnailUrl: w?.thumbnail_url ?? data.thumbnail_url,
      panoramaProxyUrl: w?.panorama_url ?? data.panorama_url,
      viewerUrl: w?.viewer_url ?? data.viewer_url,
    };
  }

  /** Follow 302 redirect to get a signed download URL for the splat file. */
  async resolveSplatDownloadUrl(requestId: string): Promise<string> {
    const res = await fetch(`${BASE}/v1/worlds/requests/${requestId}/splat`, {
      headers: authHeaders(),
      redirect: "manual",
    });
    if (res.status === 302 || res.status === 301) {
      const loc = res.headers.get("location");
      if (loc) return loc;
    }
    if (!res.ok) await parseError(res);
    throw new Error("No splat redirect URL");
  }

  async pollUntilDone(requestId: string, maxAttempts = 90, intervalMs = 8000): Promise<SpAItialStatus> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getStatus(requestId);
      if (status.status === "COMPLETED" || status.status === "FAILED" || status.status === "CANCELLED") {
        return status;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("SpAItial generation timed out");
  }
}

export const spaitialService = new SpAItialService();
