import { useEffect, useRef, useState, RefObject } from "react";
import { frameSrc, drawFrame } from "../lib/canvas";

const BATCH_SIZE = 10;

interface Opts {
  frameCount: number;
  framesPath: string;
  startAtOne?: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  nativeDimensions?: boolean;
  onProgress?: (pct: number) => void;
  onReady?: () => void;
}

export function useFrameLoader({
  frameCount,
  framesPath,
  startAtOne = true,
  canvasRef,
  nativeDimensions = false,
  onProgress,
  onReady,
}: Opts) {
  const imagesRef = useRef<(HTMLImageElement | undefined)[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    imagesRef.current = [];

    const imgs: (HTMLImageElement | undefined)[] = new Array(frameCount);
    let count = 0;

    function initCanvas(firstImg: HTMLImageElement) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      if (nativeDimensions) {
        canvas.width = firstImg.naturalWidth * dpr;
        canvas.height = firstImg.naturalHeight * dpr;
      } else {
        canvas.width = (canvas.offsetWidth || window.innerWidth) * dpr;
        canvas.height = (canvas.offsetHeight || window.innerHeight) * dpr;
      }
    }

    const firstImg = new window.Image();
    firstImg.src = frameSrc(startAtOne ? 1 : 0, framesPath);
    firstImg.onload = () => {
      imgs[0] = firstImg;
      initCanvas(firstImg);
      drawFrame(0, imgs, canvasRef.current);
      loadBatch(1);
    };
    firstImg.onerror = () => loadBatch(1);

    const remainingCount = frameCount - 1;

    function loadBatch(start: number) {
      const end = Math.min(start + BATCH_SIZE, frameCount);
      for (let i = start; i < end; i++) {
        const img = new window.Image();
        img.src = frameSrc(startAtOne ? i + 1 : i, framesPath);
        const onDone = () => {
          count++;
          onProgress?.(Math.round(((count + 1) / frameCount) * 100));
          if (count === remainingCount) {
            imagesRef.current = imgs;
            setLoaded(true);
            onReady?.();
          } else if (count % BATCH_SIZE === 0) {
            loadBatch(count + 1);
          }
        };
        img.onload = () => {
          imgs[i] = img;
          onDone();
        };
        img.onerror = () => onDone();
      }
    }
  }, [framesPath]);

  return { loaded, imagesRef };
}
