import { useState, useEffect, useRef, useCallback } from "react";
import { getSpeedStep } from "./gameUtils";

// ─── Config ───────────────────────────────────────────────────────────────────
const W = 340;
const H = 600;
const BH = 30;
const BD = 14;
const BDY = 7;
const BASE_W = 190;
const SPEED_INIT = 105;
const SPEED_MAX = 295;
const PERFECT_PX = 5;

const PALETTES = [
  ["#FF4D6D","#A0102C","#FF8FA3","#660A1C"],
  ["#FF8C42","#BF4E00","#FFC285","#7A3000"],
  ["#FFE234","#C8A200","#FFF480","#7A6200"],
  ["#39FF8F","#00A84A","#9DFFCC","#006830"],
  ["#38D9FF","#006FA0","#9AECFF","#004570"],
  ["#C679FF","#7800CC","#E3B5FF","#4A007A"],
  ["#FF63B8","#AA0060","#FFB0D8","#700040"],
  ["#63FFDA","#009975","#B0FFE8","#005E48"],
  ["#FFD460","#B08000","#FFEEA0","#6E4F00"],
];
const pal = (i: number) => PALETTES[i % PALETTES.length];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

interface StackGameProps {
  gameSeed: string;
  onGameOver: (score: number) => void;
  wagerAmount?: string;
  opponentScore?: number | null;
  disabled?: boolean;
}

export default function StackGame({ gameSeed, onGameOver, wagerAmount, opponentScore, disabled }: StackGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const lockRef = useRef(false);

  const [screen, setScreen] = useState<"start"|"playing"|"over">("start");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [showPerf, setShowPerf] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  function newGame() {
    const base = { x: (W-BASE_W)/2, w: BASE_W, y: H-BH*3, pi: 0 };
    gameRef.current = {
      placed: [base],
      moving: { x: 0, w: BASE_W, y: base.y-BH, dir: 1, speed: SPEED_INIT },
      camY: 0, camTarget: 0, score: 0, combo: 0,
      flash: 0, shake: 0, bgPhase: 0,
      particles: [] as any[], floaters: [] as any[], debris: [] as any[],
      ts: null as number|null,
    };
  }

  function burst(gObj: any, worldX: number, worldY: number, blockW: number, palette: string[], type: string) {
    const [c0] = palette;
    const count = type==="perfect" ? 40 : type==="death" ? 30 : 18;
    for (let i=0; i<count; i++) {
      const a = (Math.PI*2*i/count) + Math.random()*0.5 - 0.25;
      const spd = type==="perfect" ? 2.5+Math.random()*4 : 1+Math.random()*3;
      gObj.particles.push({
        x: worldX + Math.random()*blockW, y: worldY + BH/2,
        vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - (type==="perfect"?2:0.5),
        life: 1, decay: 0.018 + Math.random()*0.025,
        size: type==="perfect" ? 3+Math.random()*4 : 1.5+Math.random()*2.5,
        c: c0, star: type==="perfect" && i%3===0,
      });
    }
  }

  function floater(gObj: any, sx: number, sy: number, text: string, color: string) {
    gObj.floaters.push({ x: sx, y: sy, text, color, life: 1 });
  }

  const onTap = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (disabled || lockRef.current) return;
    lockRef.current = true;
    setTimeout(() => { lockRef.current = false; }, 80);

    if (screen==="start") { newGame(); setScreen("playing"); setScore(0); setCombo(0); setShowPerf(false); return; }
    if (screen==="over") return; // No retry — one attempt per wager

    const g = gameRef.current;
    if (!g) return;

    const { x:mx, w:mw, y:my, dir:mdir, speed:mspd } = g.moving;
    const prev = g.placed[g.placed.length-1];
    const left = Math.max(prev.x, mx);
    const right = Math.min(prev.x+prev.w, mx+mw);
    const overlap = right - left;
    const pi = g.placed.length;
    const p = pal(pi);
    const screenY = my + g.camY;

    if (overlap <= 0) {
      burst(g, mx, my, mw, p, "death");
      g.shake = 14;
      setFinalScore(g.score);
      setScreen("over");
      onGameOver(g.score);
      return;
    }

    const isPerf = overlap >= prev.w - PERFECT_PX;
    const nx = isPerf ? prev.x : left;
    const nw = isPerf ? prev.w : overlap;

    if (!isPerf) {
      const dx = mx < prev.x ? mx : prev.x+prev.w;
      g.debris.push({ x: dx, y: my, w: mw-overlap, vy: 0, alpha: 1, pi });
    }

    g.placed.push({ x: nx, w: nw, y: my, pi });
    burst(g, nx, my, nw, p, isPerf?"perfect":"normal");

    const newScore = g.score + (isPerf?2:1);
    const newCombo = isPerf ? g.combo+1 : 0;
    g.score = newScore; g.combo = newCombo;
    g.bgPhase = (g.bgPhase + 0.12) % (Math.PI*2);

    floater(g, nx+nw/2, screenY - 10, isPerf?"✦ PERFECT ✦":"+1", isPerf?"#FFD600":"#ffffff");
    if (isPerf) { g.flash = 28; setShowPerf(true); setTimeout(()=>setShowPerf(false),800); }

    setScore(newScore);
    setCombo(newCombo);

    const speedStep = getSpeedStep(gameSeed, pi);
    g.moving = {
      x: mdir>0 ? 0 : W-nw, w: nw, y: my-BH, dir: mdir,
      speed: Math.min(mspd+speedStep, SPEED_MAX),
    };
    g.camTarget = Math.max(0, H/2 - g.moving.y - BH*2);
  }, [screen, disabled, gameSeed, onGameOver]);

  // Render loop
  useEffect(() => {
    if (screen!=="playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function frame(ts: number) {
      const g = gameRef.current;
      if (!g) return;
      const dt = g.ts ? Math.min((ts-g.ts)/1000, 0.05) : 0;
      g.ts = ts;

      g.camY += (g.camTarget - g.camY) * 0.1;
      if (g.shake > 0) g.shake *= 0.82;
      const shakeX = g.shake>0.3 ? (Math.random()-0.5)*g.shake : 0;
      const shakeY = g.shake>0.3 ? (Math.random()-0.5)*g.shake*0.5 : 0;

      g.moving.x += g.moving.dir * g.moving.speed * dt;
      if (g.moving.x + g.moving.w >= W) { g.moving.x=W-g.moving.w; g.moving.dir=-1; }
      if (g.moving.x <= 0) { g.moving.x=0; g.moving.dir=1; }

      g.particles = g.particles.map((p:any)=>({...p,
        x:p.x+p.vx, y:p.y+p.vy, vx:p.vx*0.95, vy:p.vy+0.15, life:p.life-p.decay,
      })).filter((p:any)=>p.life>0);

      g.floaters = g.floaters.map((f:any)=>({...f, y:f.y-1.8, life:f.life-0.024})).filter((f:any)=>f.life>0);

      g.debris = g.debris.map((d:any)=>({...d,
        y:d.y+Math.abs(d.vy)+2.5, vy:d.vy+0.45, alpha:d.alpha-0.042,
      })).filter((d:any)=>d.alpha>0);

      const t = ts/1000;
      const cam = g.camY;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.fillStyle = "#04030f";
      ctx.fillRect(0,0,W,H);

      // Aurora
      const auraColors = [
        `hsla(${210+Math.sin(t*0.25)*30},90%,55%,0.07)`,
        `hsla(${280+Math.sin(t*0.18)*40},80%,60%,0.06)`,
        `hsla(${350+Math.sin(t*0.3)*25},85%,55%,0.05)`,
      ];
      for (let i=0; i<3; i++) {
        const ax = W/2 + Math.sin(t*0.22+i*2.1)*100;
        const ay = H*0.35 + Math.sin(t*0.17+i*1.3)*80;
        const ar = ctx.createRadialGradient(ax,ay,0,ax,ay,220);
        ar.addColorStop(0, auraColors[i]);
        ar.addColorStop(1, "transparent");
        ctx.fillStyle = ar;
        ctx.fillRect(0,0,W,H);
      }

      // Scanlines
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      for (let y=0; y<H; y+=4) ctx.fillRect(0,y,W,1);

      // Tower glow
      const topBlock = g.placed[g.placed.length-1];
      const topY = topBlock.y + cam;
      if (topY < H && topY > -BH) {
        const [tc] = pal(topBlock.pi);
        const tGrad = ctx.createLinearGradient(0,topY+BH,0,Math.min(H,topY+BH+120));
        tGrad.addColorStop(0, `rgba(${hexToRgb(tc)},0.18)`);
        tGrad.addColorStop(1, "transparent");
        ctx.fillStyle = tGrad;
        ctx.fillRect(0, topY+BH, W, Math.min(H,topY+BH+120)-(topY+BH));
      }

      // Placed blocks
      for (const b of g.placed) {
        const by = b.y + cam;
        if (by > H+BD+8 || by+BH < -BD-8) continue;
        drawBlock(ctx, b.x, by, b.w, pal(b.pi));
      }

      // Debris
      for (const d of g.debris) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, d.alpha);
        drawBlock(ctx, d.x, d.y+cam, d.w, pal(d.pi), 0.25);
        ctx.restore();
      }

      // Guide lines
      const prev = g.placed[g.placed.length-1];
      const guideAlpha = 0.07 + 0.05*Math.sin(t*3);
      ctx.strokeStyle = `rgba(255,255,255,${guideAlpha})`;
      ctx.setLineDash([3,5]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y+cam+BH); ctx.lineTo(prev.x, g.moving.y+cam); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(prev.x+prev.w, prev.y+cam+BH); ctx.lineTo(prev.x+prev.w, g.moving.y+cam); ctx.stroke();
      ctx.setLineDash([]);

      // Moving block
      const pulse = 0.72 + 0.28*Math.sin(t*2.6);
      ctx.save();
      ctx.globalAlpha = pulse;
      drawBlock(ctx, g.moving.x, g.moving.y+cam, g.moving.w, pal(g.placed.length), 1.9);
      ctx.restore();

      // Speed lines
      const speedRatio = (g.moving.speed - 150) / (SPEED_MAX - 150);
      if (speedRatio > 0) {
        ctx.strokeStyle = `rgba(255,255,255,${speedRatio*0.12})`;
        ctx.lineWidth = 1;
        const lineCount = Math.floor(speedRatio * 10);
        for (let i=0; i<lineCount; i++) {
          const lx = Math.random()*W;
          const ly = Math.random()*H;
          const len = 15 + speedRatio*25;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + g.moving.dir*len*speedRatio, ly + (Math.random()-0.5)*4);
          ctx.stroke();
        }
      }

      // Particles
      for (const p of g.particles) {
        const py = p.y + cam;
        if (py < -10 || py > H+10) continue;
        ctx.save();
        ctx.globalAlpha = p.life * p.life;
        ctx.shadowColor = p.c;
        ctx.shadowBlur = p.star ? 14 : 8;
        ctx.fillStyle = p.c;
        if (p.star) { drawStar(ctx, p.x, py, p.size); }
        else { ctx.beginPath(); ctx.arc(p.x, py, p.size, 0, Math.PI*2); ctx.fill(); }
        ctx.restore();
      }

      // Floaters
      ctx.textAlign = "center";
      for (const f of g.floaters) {
        ctx.save();
        ctx.globalAlpha = f.life * f.life;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = f.color;
        const isP = f.text.includes("PERFECT");
        ctx.font = `900 ${isP?15:13}px 'Orbitron', monospace`;
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      }

      // Flash
      if (g.flash > 0) {
        const fAlpha = (g.flash/28) * 0.22;
        const fGrad = ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,W*0.8);
        fGrad.addColorStop(0, `rgba(255,240,100,${fAlpha*2})`);
        fGrad.addColorStop(1, `rgba(255,200,50,${fAlpha*0.3})`);
        ctx.fillStyle = fGrad;
        ctx.fillRect(0,0,W,H);
        g.flash--;
      }

      // Combo border
      if (g.combo >= 2) {
        const intensity = Math.min((g.combo-1)/6, 1);
        const comboHue = 50 - intensity*50;
        ctx.strokeStyle = `hsla(${comboHue},100%,60%,${0.3+intensity*0.5})`;
        ctx.lineWidth = 1.5 + intensity*2.5;
        ctx.shadowColor = `hsla(${comboHue},100%,60%,1)`;
        ctx.shadowBlur = 8 + intensity*18;
        ctx.strokeRect(2,2,W-4,H-4);
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, palette: string[], glow=1) {
    if (w <= 0) return;
    const [c0, c1, cTop, cSide] = palette;
    const r = Math.min(5, w/2, BH/2);

    ctx.save();
    ctx.fillStyle = cSide;
    ctx.globalAlpha = (ctx.globalAlpha||1) * 0.85;
    ctx.beginPath();
    ctx.moveTo(x+w, y); ctx.lineTo(x+w+BD, y-BDY); ctx.lineTo(x+w+BD, y-BDY+BH); ctx.lineTo(x+w, y+BH);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = cTop;
    ctx.globalAlpha = (ctx.globalAlpha||1) * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x+BD, y-BDY); ctx.lineTo(x+w+BD, y-BDY); ctx.lineTo(x+w, y);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    const gr = ctx.createLinearGradient(x, y, x, y+BH);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    ctx.shadowColor = c0;
    ctx.shadowBlur = 14*glow;
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+BH, r);
    ctx.arcTo(x+w, y+BH, x, y+BH, r);
    ctx.arcTo(x, y+BH, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(x+r, y+1, w-r*2, 3);
  }

  function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.beginPath();
    for (let i=0; i<10; i++) {
      const a = (i*Math.PI/5) - Math.PI/2;
      const rad = i%2===0 ? r : r*0.4;
      if (i===0) ctx.moveTo(x+Math.cos(a)*rad, y+Math.sin(a)*rad);
      else ctx.lineTo(x+Math.cos(a)*rad, y+Math.sin(a)*rad);
    }
    ctx.closePath(); ctx.fill();
  }

  const comboActive = combo >= 2;
  const comboHue = Math.max(0, 50 - (combo-2)*8);
  const comboColor = comboActive ? `hsl(${comboHue},100%,62%)` : "#40C4FF";
  const scoreGlow = comboActive
    ? `0 0 30px ${comboColor}99, 0 0 70px ${comboColor}44`
    : "0 0 28px rgba(64,196,255,0.45)";

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", fontFamily:"'Orbitron',monospace",
      userSelect:"none", WebkitUserSelect:"none",
    }}>
      {/* Wager badge */}
      {wagerAmount && screen==="playing" && (
        <div style={{
          background:"rgba(255,77,109,0.15)", border:"1px solid rgba(255,77,109,0.3)",
          borderRadius:12, padding:"4px 14px", marginBottom:6,
          fontSize:10, color:"#FF4D6D", letterSpacing:2, fontWeight:700,
        }}>💰 {wagerAmount} INIT AT STAKE</div>
      )}

      {/* Score */}
      <div style={{textAlign:"center", marginBottom:6}}>
        <div style={{
          fontSize:60, fontWeight:900, color:"white", lineHeight:1,
          textShadow:scoreGlow, transition:"text-shadow 0.4s", letterSpacing:-2,
        }}>{score}</div>
        {opponentScore !== null && opponentScore !== undefined && (
          <div style={{color:"rgba(255,255,255,0.35)", fontSize:10, letterSpacing:3, marginTop:3}}>
            OPPONENT: {opponentScore}
          </div>
        )}
      </div>

      {/* Badges */}
      <div style={{height:28, marginBottom:6, display:"flex", alignItems:"center", gap:10}}>
        {showPerf && (
          <div style={{
            background:"linear-gradient(90deg,#FFD600,#FF8000)",
            borderRadius:20, padding:"3px 16px",
            fontSize:11, fontWeight:900, color:"#000", letterSpacing:2,
            boxShadow:"0 0 24px rgba(255,200,0,0.9), 0 0 60px rgba(255,150,0,0.4)",
          }}>✦ PERFECT ✦</div>
        )}
        {comboActive && !showPerf && (
          <div style={{
            border:`1.5px solid ${comboColor}88`, borderRadius:20, padding:"3px 14px",
            fontSize:11, fontWeight:700, color:comboColor, letterSpacing:1,
            boxShadow:`0 0 14px ${comboColor}55`,
          }}>×{combo} COMBO</div>
        )}
      </div>

      {/* Game canvas */}
      <div
        onPointerDown={onTap}
        style={{
          position:"relative", cursor:"pointer", touchAction:"none",
          borderRadius:22, overflow:"hidden",
          boxShadow:"0 0 0 1px rgba(255,255,255,0.07), 0 40px 100px rgba(0,0,0,0.8)",
        }}
      >
        <canvas ref={canvasRef} width={W} height={H} style={{display:"block"}}/>

        {/* Start screen */}
        {screen==="start" && (
          <div style={{
            position:"absolute", inset:0,
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            background:"rgba(2,2,14,0.92)", backdropFilter:"blur(10px)",
          }}>
            <div style={{
              fontSize:76, fontWeight:900, lineHeight:0.88, letterSpacing:-4,
              background:"linear-gradient(135deg,#40C4FF 0%,#A855F7 45%,#FF4D6D 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
              filter:"drop-shadow(0 0 40px rgba(100,100,255,0.5))",
            }}>STACK</div>

            <div style={{
              width:180, height:1.5, marginTop:22,
              background:"linear-gradient(90deg,transparent,#40C4FF80,#A855F780,transparent)",
            }}/>

            <div style={{ marginTop:22, color:"rgba(255,255,255,0.32)", fontSize:11, letterSpacing:5 }}>
              TAP TO START
            </div>

            <div style={{ marginTop:28, display:"flex", flexDirection:"column", gap:6, alignItems:"center" }}>
              {[["🎯","Perfect alignment = +2 pts"], ["⚡","Speed increases every block"], ["🔥","Chain perfects for combo"]].map(([icon,txt])=>(
                <div key={txt} style={{color:"rgba(255,255,255,0.15)", fontSize:10, letterSpacing:1}}>
                  {icon} {txt}
                </div>
              ))}
            </div>

            {wagerAmount && (
              <div style={{
                marginTop:24, background:"rgba(255,77,109,0.12)",
                border:"1px solid rgba(255,77,109,0.25)", borderRadius:14,
                padding:"8px 20px", color:"#FF4D6D", fontSize:12, letterSpacing:2,
              }}>💰 {wagerAmount} INIT AT STAKE</div>
            )}
          </div>
        )}

        {/* Game over */}
        {screen==="over" && (
          <div style={{
            position:"absolute", inset:0,
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            background:"rgba(2,2,14,0.94)", backdropFilter:"blur(12px)",
          }}>
            <div style={{fontSize:10, color:"#FF4D6D", letterSpacing:6, marginBottom:14}}>
              GAME OVER
            </div>
            <div style={{
              fontSize:84, fontWeight:900, color:"white", lineHeight:1,
              textShadow:"0 0 50px rgba(255,77,109,0.7), 0 0 100px rgba(255,77,109,0.3)",
              letterSpacing:-4,
            }}>{finalScore}</div>

            <div style={{
              marginTop:20, color:"rgba(255,255,255,0.35)", fontSize:11, letterSpacing:3,
            }}>SCORE SUBMITTED</div>

            <div style={{
              marginTop:8, color:"rgba(255,255,255,0.2)", fontSize:10, letterSpacing:2,
            }}>Waiting for opponent...</div>
          </div>
        )}
      </div>

      {screen==="playing" && (
        <div style={{color:"rgba(255,255,255,0.12)", fontSize:9, marginTop:10, letterSpacing:4}}>
          TAP TO PLACE
        </div>
      )}
    </div>
  );
}
