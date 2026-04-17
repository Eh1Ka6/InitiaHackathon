import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const TAGLINE = "Not your grandma's lottery.";
const TYPING_INTERVAL = 55;
const OVERLAP_RATIO = 0.8;
const VIDEO_MAX_DURATION = 7.55;

export default function Splash() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoWrapRef = useRef<HTMLDivElement>(null);

  const [typedText, setTypedText] = useState("");
  const [videoStarted, setVideoStarted] = useState(false);
  const [winStarted, setWinStarted] = useState(false);

  // Typing effect
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedText(TAGLINE.slice(0, i));
      if (i >= TAGLINE.length) {
        clearInterval(timer);
        setVideoStarted(true);
      }
    }, TYPING_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Start video
  useEffect(() => {
    if (!videoStarted) return;
    const video = videoRef.current;
    if (!video) return;
    const play = () => {
      video.playbackRate = 2;
      video.play().catch(() => {});
    };
    if (video.readyState >= 3) play();
    else {
      video.load();
      video.addEventListener("canplaythrough", play, { once: true });
      return () => video.removeEventListener("canplaythrough", play);
    }
  }, [videoStarted]);

  // Fade video + trigger Win Different
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handle = () => {
      if (!video.duration) return;
      const ratio = video.currentTime / video.duration;
      if (videoWrapRef.current) {
        videoWrapRef.current.style.opacity = ratio <= 0.1 ? String(ratio / 0.1) : "1";
      }
      if (video.currentTime >= VIDEO_MAX_DURATION || ratio >= OVERLAP_RATIO) {
        setWinStarted(true);
      }
    };
    video.addEventListener("timeupdate", handle);
    return () => video.removeEventListener("timeupdate", handle);
  }, []);

  return (
    <div
      className="relative w-full min-h-screen overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse 50% 45% at 0% 0%, #013f88 0%, transparent 100%),
          radial-gradient(ellipse 50% 50% at 100% 100%, #608ec9 0%, transparent 80%),
          linear-gradient(180deg,#013f88 0%,#054189 10%,#0e4891 20%,#1c5199 30%,#2d62a5 40%,#3a6cad 50%,#4477b6 60%,#4a7cb9 70%,#4e80bc 80%,#5284bf 90%,#5586c1 100%)
        `,
      }}
    >
      {/* Video BACKGROUND — absolute, can be overlapped by Win Different */}
      <div
        ref={videoWrapRef}
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          visibility: videoStarted ? "visible" : "hidden",
          opacity: 0,
          transition: "opacity 0.3s",
        }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          controls={false}
          preload="auto"
          className="w-full h-full object-contain max-h-[60vh]"
        >
          <source src="/home/logo_ios2.mov" type='video/quicktime; codecs="hvc1"' />
          <source src="/home/hero.webm" type="video/webm" />
        </video>
      </div>

      {/* Foreground content grid */}
      <div className="relative z-10 min-h-screen flex flex-col px-6 pt-14 pb-8">
        {/* Tagline */}
        <p
          className="text-center text-white text-xl"
          style={{
            fontFamily: "var(--font-sequel-sans)",
            fontWeight: 310,
            minHeight: "1.5rem",
          }}
        >
          {typedText}
        </p>

        {/* Spacer to push bottom content up ~halfway */}
        <div className="flex-1" />

        {/* Win Different + Buttons — overlaps the logo */}
        <div>
          <h1
            className="text-white mb-5 transition-all duration-500"
            style={{
              fontFamily: "var(--font-sequel-sans)",
              fontWeight: 300,
              letterSpacing: "-2.624px",
              fontSize: "clamp(2.4rem, 16vw, 63px)",
              lineHeight: 0.9375,
              opacity: winStarted ? 1 : 0,
              transform: winStarted ? "translateY(0)" : "translateY(20px)",
              textShadow: "0 2px 20px rgba(0,0,0,0.35)",
            }}
          >
            <span style={{ fontWeight: 600 }}>Win</span>
            <br />
            <span>Different</span>
          </h1>
          <div
            className="flex gap-3 transition-all duration-500"
            style={{
              opacity: winStarted ? 1 : 0,
              transform: winStarted ? "translateY(0)" : "translateY(16px)",
              transitionDelay: "0.1s",
            }}
          >
            <button
              onClick={() => navigate("/games/cash")}
              className="flex-1 py-3 text-center text-white text-xl rounded-xl transition-all duration-200 active:brightness-95 backdrop-blur-md"
              style={{
                fontFamily: "var(--font-sequel-sans)",
                fontWeight: 700,
                letterSpacing: "-1.6px",
                background:
                  "linear-gradient(135deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 100%)",
                border: "1px solid rgba(255,255,255,0.3)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.12)",
              }}
            >
              Cash Game
            </button>
            <button
              onClick={() => navigate("/games/free")}
              className="flex-1 py-3 text-center text-white text-xl rounded-xl transition-all duration-200 active:brightness-95 backdrop-blur-md"
              style={{
                fontFamily: "var(--font-sequel-sans)",
                fontWeight: 400,
                letterSpacing: "-1.2px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              Free Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
