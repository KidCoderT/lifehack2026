/**
 * Re-encode an image file to JPEG in the browser. Fixes two things at once: iOS hands
 * over HEIC that most browsers outside Safari cannot decode, and a phone photo is
 * multiple megabytes for something displayed at a few hundred pixels.
 *
 * `square` centre-crops to size x size — right for avatars, wrong for evidence photos,
 * where cropping can cut out the very thing being photographed. Non-square clamps the
 * longest edge to `size` and keeps the aspect ratio.
 *
 * Throws if the file cannot be decoded (the HEIC case). Callers must surface that as a
 * readable error rather than failing silently.
 */
export async function toJpeg(file: File, size: number, square = false): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  if (square) {
    const side = Math.min(bmp.width, bmp.height);
    canvas.width = canvas.height = size;
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  } else {
    const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  }

  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}
