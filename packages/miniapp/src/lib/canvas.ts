export function frameSrc(index: number, basePath: string): string {
  return `${basePath}${String(index).padStart(4, "0")}.webp`;
}

export function drawFrame(
  index: number,
  images: (HTMLImageElement | undefined)[],
  canvas: HTMLCanvasElement | null
): void {
  if (!canvas || !images[index]) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = images[index]!;
  const w = canvas.width;
  const h = canvas.height;

  const canvasRatio = w / h;
  const imgRatio = img.naturalWidth / img.naturalHeight;

  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > canvasRatio) {
    sh = img.naturalHeight;
    sw = sh * canvasRatio;
    sx = (img.naturalWidth - sw) / 2;
    sy = 0;
  } else {
    sw = img.naturalWidth;
    sh = sw / canvasRatio;
    sx = 0;
    sy = (img.naturalHeight - sh) / 2;
  }

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}
