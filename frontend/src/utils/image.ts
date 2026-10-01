/**
 * Photos, logos and receipts are stored inside the database, so every byte
 * uploaded is a byte the API later has to read back. A phone camera picture
 * is 3–8 MB; an avatar never needs more than a few hundred pixels. Shrinking
 * in the browser before upload keeps what we store ~50x smaller.
 */

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    img.src = url;
  });

/**
 * Returns the image scaled down so its longest side is at most `maxSide`
 * pixels, re-encoded as WebP (keeps transparency, much smaller than PNG).
 * Falls back to the original file whenever shrinking isn't possible or
 * wouldn't help (already small, animated GIF, canvas unavailable).
 */
export async function downscaleImage(
  file: File,
  maxSide: number,
  quality = 0.85,
): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    // Browsers without WebP encoding hand back PNG (or nothing) — only use
    // the result when it really is the smaller WebP we asked for.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo"));
    reader.readAsDataURL(blob);
  });
