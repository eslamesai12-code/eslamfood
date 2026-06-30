/**
 * Compresses an image file (or base64 string) using an HTML Canvas to a safe size and resolution.
 * @param fileOrBase64 - The input File object or a base64 DataURL string.
 * @param maxWidth - The maximum width allowed (default 800px).
 * @param maxHeight - The maximum height allowed (default 800px).
 * @param quality - The quality of the output JPEG (0.0 to 1.0, default 0.75).
 * @returns A promise that resolves to the compressed base64 data URL.
 */
export function compressImage(
  fileOrBase64: File | string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (fileOrBase64 instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolveCompress(e.target.result as string, maxWidth, maxHeight, quality, resolve, reject);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(new Error("File reader error"));
      reader.readAsDataURL(fileOrBase64);
    } else {
      resolveCompress(fileOrBase64, maxWidth, maxHeight, quality, resolve, reject);
    }
  });
}

function resolveCompress(
  base64Str: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  resolve: (val: string) => void,
  reject: (err: Error) => void
) {
  // If it's not an image (e.g., video data), we cannot compress using Canvas.
  // Just return the original base64 and let the size checker handle the limit.
  if (!base64Str.startsWith("data:image/")) {
    resolve(base64Str);
    return;
  }

  const img = new Image();
  img.onload = () => {
    try {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions while scaling proportionally
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to original if 2d context fails
        resolve(base64Str);
        return;
      }

      // Draw image onto canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed jpeg base64
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedDataUrl);
    } catch (e) {
      console.error("Canvas compression failed", e);
      resolve(base64Str); // Fallback to original
    }
  };
  img.onerror = () => {
    resolve(base64Str); // Fallback to original if load fails (e.g. invalid format)
  };
  img.src = base64Str;
}

/**
 * Checks if a base64 string exceeds the safe size limit for Firestore (850KB).
 * @param base64Str - The base64 string.
 * @returns True if the size is safe, False if it is too big.
 */
export function isSizeSafe(base64Str: string): boolean {
  if (!base64Str) return true;
  // Use the actual character length of the base64 string because it is stored as a UTF-8 string field in Firestore.
  // 1 character = 1 byte in memory/storage. We set a 750KB limit to leave ample space for other fields (limit is 1,048,576 bytes).
  const stringLength = base64Str.length;
  const maxBytes = 750 * 1024; // 750 KB safe limit
  return stringLength <= maxBytes;
}
