import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrameLoader } from "../hooks/useFrameLoader";
import { drawFrame } from "../lib/canvas";
import EnterDrawModal from "../components/EnterDrawModal";

const FRAME_COUNT = 120;
const FRAMES_PATH = "/home/frames_array/sm/";

const SLIDES = [
  {
    icon: "/home/rotate_icon.png",
    amount: "$10",
    sub: "Current prize: 0.00025 BTC*",
    tag: "BONUS",
    bonus: "+5 WEEZ",
    ticketPrice: "1 INIT",
    maxTickets: "100",
    progress: 40,
  },
  {
    icon: "/home/rotate_icon.png",
    amount: "$50",
    sub: "Current prize: 0.00125 BTC*",
    tag: "BONUS",
    bonus: "+25 WEEZ",
    ticketPrice: "5 INIT",
    maxTickets: "200",
    progress: 65,
  },
  {
    icon: "/home/rotate_icon.png",
    amount: "$500",
    sub: "Current prize: 0.01156 BTC*",
    tag: "BONUS",
    bonus: "+100 WEEZ",
    ticketPrice: "50 INIT",
    maxTickets: "500",
    progress: 20,
  },
];

const DUR_FRAMES_MS = 2500;
const DUR_FLIP_MS = 500;
const CONTENT_START = 0.8;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export default function CashGame() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const [progress, setProgress] = useState(0);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [slideIndex, setSlideIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase] = useState<"frames" | "idle" | "flipping">("frames");

  const frameObj = useRef({ current: 0 });
  const rotateYRef = useRef(0);
  const animRef = useRef<number | null>(null);

  const { loaded, imagesRef } = useFrameLoader({
    frameCount: FRAME_COUNT,
    framesPath: FRAMES_PATH,
    startAtOne: true,
    canvasRef,
    nativeDimensions: true,
    onProgress: (pct) => setProgress((prev) => Math.max(prev, pct)),
    onReady: () => {
      setTimeout(() => setLoaderVisible(false), 400);
    },
  });

  const render = (frame: number) => {
    if (!canvasRef.current) return;
    drawFrame(
      Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(frame))),
      imagesRef.current,
      canvasRef.current
    );
  };

  const applyRotation = (deg: number) => {
    rotateYRef.current = deg;
    if (cardRef.current)
      cardRef.current.style.transform = `rotateY(${deg}deg)`;
    if (contentRef.current)
      contentRef.current.style.transform = `rotateY(${-deg}deg)`;
  };

  const updateSlideDOM = (index: number) => {
    const slide = SLIDES[index];
    const el = contentRef.current;
    if (!el) return;
    const set = (sel: string, val: string) => {
      const n = el.querySelector(sel);
      if (n) n.textContent = val;
    };
    set("[data-amount]", slide.amount);
    set("[data-sub]", slide.sub);
    set("[data-tag]", slide.tag);
    set("[data-bonus]", slide.bonus);
    set("[data-ticket]", slide.ticketPrice);
    set("[data-tickets]", slide.maxTickets);
    const bar = el.querySelector("[data-bar]") as HTMLElement | null;
    if (bar) bar.style.width = `${slide.progress}%`;
  };

  useEffect(() => {
    if (!loaded) return;
    setPhase("frames");
    updateSlideDOM(0);
    if (contentRef.current) contentRef.current.style.opacity = "0";
    applyRotation(0);

    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / DUR_FRAMES_MS);
      const eased = easeInOut(t);
      frameObj.current.current = eased * (FRAME_COUNT - 1);
      render(frameObj.current.current);

      if (t > CONTENT_START && contentRef.current) {
        const op = (t - CONTENT_START) / (1 - CONTENT_START);
        contentRef.current.style.opacity = String(op);
      }
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        if (contentRef.current) contentRef.current.style.opacity = "1";
        setPhase("idle");
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [loaded]);

  const flipTo = (newIndex: number) => {
    if (phase === "flipping" || newIndex === slideIndex) return;
    setPhase("flipping");

    const from = rotateYRef.current;
    const diff = newIndex - slideIndex;
    const to = from + diff * 180;

    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / DUR_FLIP_MS);
      const eased = easeInOut(t);
      const deg = from + (to - from) * eased;
      applyRotation(deg);
      if (
        t >= 0.5 &&
        contentRef.current?.getAttribute("data-slide") !== String(newIndex)
      ) {
        updateSlideDOM(newIndex);
        contentRef.current?.setAttribute("data-slide", String(newIndex));
      }
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSlideIndex(newIndex);
        setPhase("idle");
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const dir = dx < 0 ? 1 : -1;
    const next = (slideIndex + dir + SLIDES.length) % SLIDES.length;
    flipTo(next);
  };

  const slide = SLIDES[slideIndex];
  const s0 = SLIDES[0];

  return (
    <>
      {/* Loader */}
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-16 pointer-events-none transition-opacity duration-[400ms]"
        style={{
          background: "linear-gradient(180deg,#119BAF 0%,#72DBEA 100%)",
          opacity: loaderVisible ? 1 : 0,
        }}
      >
        <div className="w-[260px] flex flex-col gap-3">
          <p className="text-white/50 text-xs text-center tracking-widest uppercase">
            Loading
          </p>
          <div className="w-full h-1 rounded-full overflow-hidden bg-white/15">
            <div
              className="h-full rounded-full bg-white/80 transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className="fixed inset-0 overflow-hidden flex items-center justify-center"
        style={{
          background: "linear-gradient(180deg,#119BAF 0%,#72DBEA 100%)",
          touchAction: "pan-y",
          fontFamily: "var(--font-sequel-sans)",
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="relative h-screen aspect-square max-w-screen max-h-screen"
          style={{ perspective: "1200px", transform: "translateY(-30px)" }}
        >
          <div
            ref={cardRef}
            className="relative w-full h-full"
            style={{ willChange: "transform" }}
          >
            <canvas ref={canvasRef} className="block w-full h-full" />
            <div
              ref={contentRef}
              data-slide="0"
              className="absolute flex flex-col items-center justify-center gap-4 px-4"
              style={{
                top: "21.04%",
                left: "31.01%",
                right: "29.35%",
                bottom: "19.38%",
                opacity: 0,
                containerType: "inline-size",
              }}
            >
              <img
                src="/home/rotate_icon.png"
                alt=""
                className="w-[30%] aspect-square object-contain"
              />
              <div className="flex flex-col items-center">
                <span
                  data-amount
                  className="text-white"
                  style={{
                    fontWeight: 600,
                    fontSize: "clamp(1.5rem, 10cqw, 3.5rem)",
                  }}
                >
                  {s0.amount}
                </span>
                <span
                  data-sub
                  className="text-white/70 text-center mt-1"
                  style={{
                    fontSize: "clamp(0.45rem, 2.8cqw, 0.8rem)",
                    fontWeight: 310,
                  }}
                >
                  {s0.sub}
                </span>
              </div>
              <div
                className="w-full flex flex-col items-center gap-1"
                style={{
                  border: "1px solid #fff",
                  borderRadius: 12,
                  padding: "12px 24px",
                  background: "#ffffff0d",
                }}
              >
                <span
                  data-tag
                  className="text-white/80 uppercase tracking-widest"
                  style={{
                    fontSize: "clamp(0.4rem, 2.8cqw, 1rem)",
                    fontWeight: 300,
                  }}
                >
                  {s0.tag}
                </span>
                <span
                  data-bonus
                  className="text-white"
                  style={{
                    fontWeight: 600,
                    fontSize: "clamp(0.55rem, 4cqw, 1.5rem)",
                  }}
                >
                  {s0.bonus}
                </span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden bg-white/15">
                <div
                  data-bar
                  className="h-full rounded-full bg-white/80 transition-[width] duration-500"
                  style={{ width: `${s0.progress}%` }}
                />
              </div>
              <div className="w-full flex justify-between">
                <div className="flex flex-col items-start">
                  <span
                    className="text-white/70"
                    style={{
                      fontSize: "clamp(0.4rem, 2.8cqw, 1rem)",
                      fontWeight: 300,
                    }}
                  >
                    Ticket Price
                  </span>
                  <span
                    className="text-white flex items-center gap-1"
                    style={{
                      fontWeight: 600,
                      fontSize: "clamp(0.5rem, 3.5cqw, 1.25rem)",
                    }}
                  >
                    🏷 <span data-ticket>{s0.ticketPrice}</span>
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span
                    className="text-white/70"
                    style={{
                      fontSize: "clamp(0.4rem, 2.8cqw, 1rem)",
                      fontWeight: 300,
                    }}
                  >
                    Max Tickets
                  </span>
                  <span
                    className="text-white flex items-center gap-1"
                    style={{
                      fontWeight: 600,
                      fontSize: "clamp(0.5rem, 3.5cqw, 1.25rem)",
                    }}
                  >
                    🎟 <span data-tickets>{s0.maxTickets}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {phase !== "frames" && (
          <div className="absolute top-4 left-0 right-0 flex justify-center gap-2 z-30">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => flipTo(i)}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === slideIndex ? 24 : 8,
                  background:
                    i === slideIndex ? "#fff" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => navigate("/profile")}
          className="fixed top-3 right-3 z-30 w-10 h-10 rounded-full flex items-center justify-center text-white text-lg"
          style={{
            background: "rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        >
          👤
        </button>

        {phase !== "frames" && (
          <div
            className="fixed left-0 right-0 flex justify-center pointer-events-none z-50 transition-opacity duration-300"
            style={{
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
              opacity: phase === "idle" ? 1 : 0,
            }}
          >
            <button
              onClick={() => setShowModal(true)}
              className="pointer-events-auto text-white text-2xl rounded-xl active:brightness-95 transition-all"
              style={{
                fontWeight: 700,
                letterSpacing: "-1.2px",
                width: "calc(100vw - 48px)",
                maxWidth: 351,
                height: 52,
                background:
                  "linear-gradient(121.55deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.1) 100%)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.4), inset -1px 0 0 rgba(255,255,255,0.4), inset 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(255,255,255,0.4)",
              }}
            >
              Enter the game
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <EnterDrawModal slide={slide} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
