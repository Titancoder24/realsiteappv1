import { stitchFramesToEquirectangular, type StitchResult } from "@/lib/capture/pannellum-stitch";

/** Run stitch off main thread via idle chunks when worker unavailable. */
export async function stitchInBackground(
  frames: { yaw: number; blob: Blob; exposure?: number; pitch?: number; roll?: number }[],
  onProgress?: (pct: number) => void,
): Promise<StitchResult> {
  return new Promise((resolve, reject) => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => {
        stitchFramesToEquirectangular(frames, onProgress).then(resolve).catch(reject);
      });
    } else {
      setTimeout(() => {
        stitchFramesToEquirectangular(frames, onProgress).then(resolve).catch(reject);
      }, 16);
    }
  });
}
