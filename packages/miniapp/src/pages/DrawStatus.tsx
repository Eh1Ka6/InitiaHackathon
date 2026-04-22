import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, type Draw, type DrawStatus as DS } from "../services/api";
import { useInterwovenKit } from "../lib/interwovenkit-stub";
import MultiplierReveal from "../components/MultiplierReveal";

const POLL_MS = 3000;

function chainFlag(chainId: string): string {
  switch (chainId) {
    case "137":
      return "🟣";
    case "56":
      return "🟡";
    case "interwoven-1":
      return "🔷";
    default:
      return "⛓";
  }
}

function chainName(chainId: string): string {
  switch (chainId) {
    case "137":
      return "Polygon";
    case "56":
      return "BNB";
    case "interwoven-1":
      return "Initia";
    default:
      return chainId;
  }
}

function truncate(addr: string): string {
  if (!addr) return "";
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function ProgressTile({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-3 text-center"
      style={{
        background: done
          ? "linear-gradient(135deg, rgba(64,196,255,0.2), rgba(168,85,247,0.15))"
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.14)"}`,
      }}
    >
      <div className="text-white/60 text-[9px] uppercase tracking-widest">
        {label}
      </div>
      <div className="text-white text-lg mt-1">
        {done ? "✓" : active ? "…" : "·"}
      </div>
    </div>
  );
}

export default function DrawStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address, openBridge } = useInterwovenKit();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgingDir, setBridgingDir] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const tick = async () => {
      try {
        const d = await api.getDraw(id);
        if (!alive) return;
        setDraw(d);
        if (d.status === "SETTLED" || d.status === "CANCELLED") {
          return; // stop polling
        }
        pollRef.current = window.setTimeout(tick, POLL_MS);
      } catch (e: any) {
        if (!alive) return;
        setError(String(e?.message || e));
        pollRef.current = window.setTimeout(tick, POLL_MS * 2);
      }
    };
    tick();
    return () => {
      alive = false;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [id]);

  const progress = useMemo(() => {
    const s: DS | undefined = draw?.status;
    const deposits = (draw?.participants.length ?? 0) > 0;
    const qualifiers =
      !!s &&
      (["QUALIFIED", "RANDOMNESS_REQUESTED", "SETTLED"] as DS[]).includes(s);
    const scoresIn =
      !!s &&
      (
        [
          "AWAITING_QUALIFIERS",
          "QUALIFIED",
          "RANDOMNESS_REQUESTED",
          "SETTLED",
        ] as DS[]
      ).includes(s);
    const vrfDone = s === "SETTLED";
    const settled = s === "SETTLED";
    return { deposits, scoresIn, qualifiers, vrfDone, settled };
  }, [draw]);

  const isWinner = !!(draw && draw.winner && address && draw.winner === address);

  const handleReverseBridge = async (dstChainId: string) => {
    if (!draw || !draw.payoutInit) return;
    setBridgingDir(dstChainId);
    try {
      await openBridge({
        srcChainId: "interwoven-1",
        srcDenom: "uinit",
        dstChainId,
        dstDenom: "native",
        amount: draw.payoutInit,
      });
    } catch (err) {
      console.error("[DrawStatus] reverse bridge failed", err);
    } finally {
      setBridgingDir(null);
    }
  };

  return (
    <div
      className="fixed inset-0 overflow-y-auto flex flex-col items-center"
      style={{
        background:
          "radial-gradient(ellipse 50% 45% at 0% 0%, #013f88 0%, transparent 100%), radial-gradient(ellipse 50% 50% at 100% 100%, #608ec9 0%, transparent 80%), linear-gradient(180deg,#013f88 0%,#1c5199 50%,#5586c1 100%)",
        fontFamily: "var(--font-sequel-sans)",
      }}
    >
      <div className="w-full max-w-[420px] px-4 pt-14 pb-8">
        <div
          className="text-white/60 text-[10px] uppercase tracking-[0.35em] text-center"
          style={{ fontWeight: 500 }}
        >
          Draw #{id}
        </div>
        <h1
          className="text-white text-center text-3xl mt-1 mb-6"
          style={{ fontWeight: 600, letterSpacing: "-1px" }}
        >
          Draw Status
        </h1>

        {error && (
          <div
            className="rounded-2xl p-3 mb-4 text-red-200 text-xs text-center"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            {error}
          </div>
        )}

        {!draw && !error && (
          <div className="text-white/60 text-center text-sm py-10">
            Loading draw…
          </div>
        )}

        {draw && (
          <>
            {/* Progress tiles */}
            <div className="grid grid-cols-5 gap-2 mb-5">
              <ProgressTile label="Deposits" done={progress.deposits} />
              <ProgressTile label="Scores" done={progress.scoresIn} />
              <ProgressTile label="Qualifiers" done={progress.qualifiers} />
              <ProgressTile
                label="VRF"
                done={progress.vrfDone}
                active={draw.status === "RANDOMNESS_REQUESTED"}
              />
              <ProgressTile label="Settled" done={progress.settled} />
            </div>

            {/* Participants */}
            <div
              className="rounded-3xl p-4 mb-4 text-white"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              <div
                className="text-white/60 text-[10px] uppercase tracking-[0.35em] mb-3"
                style={{ fontWeight: 500 }}
              >
                Players
              </div>
              {draw.participants.length === 0 && (
                <div className="text-white/50 text-sm text-center py-4">
                  No entries yet.
                </div>
              )}
              {draw.participants.map((p) => (
                <div
                  key={p.walletAddress}
                  className="flex items-center gap-3 py-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="text-xl">{chainFlag(p.homeChainId)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ fontWeight: 600 }}>
                      {p.displayName || truncate(p.walletAddress)}
                    </div>
                    <div className="text-white/50 text-[10px]">
                      {chainName(p.homeChainId)}
                    </div>
                  </div>
                  {typeof p.score === "number" && (
                    <div className="text-sm" style={{ fontWeight: 600 }}>
                      {p.score}
                    </div>
                  )}
                  {p.qualified && (
                    <div
                      className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-full"
                      style={{
                        background: "rgba(64,196,255,0.15)",
                        border: "1px solid rgba(64,196,255,0.4)",
                      }}
                    >
                      Qualified
                    </div>
                  )}
                  {p.isWinner && (
                    <div
                      className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-full"
                      style={{
                        background: "rgba(255,215,0,0.2)",
                        border: "1px solid rgba(255,215,0,0.5)",
                      }}
                    >
                      Winner
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Settlement panel */}
            {draw.status === "SETTLED" && draw.finalMultiplier && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl p-6 text-white mb-4"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(168,85,247,0.1))",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,215,0,0.35)",
                }}
              >
                <MultiplierReveal finalMultiplier={draw.finalMultiplier} />
                <div className="text-center mt-4">
                  <div className="text-white/60 text-[10px] uppercase tracking-widest">
                    Payout
                  </div>
                  <div
                    className="text-white text-3xl mt-1"
                    style={{ fontWeight: 700, letterSpacing: "-1px" }}
                  >
                    {draw.payoutInit} INIT
                  </div>
                  <div className="text-white/60 text-xs mt-1">
                    Winner: {truncate(draw.winner || "")}
                  </div>
                </div>

                {isWinner && (
                  <div className="mt-5 space-y-2">
                    <div
                      className="text-white/70 text-[10px] uppercase tracking-widest text-center"
                      style={{ fontWeight: 500 }}
                    >
                      Bridge your winnings
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleReverseBridge("137")}
                        disabled={bridgingDir !== null}
                        className="py-2 rounded-xl text-xs text-white disabled:opacity-50"
                        style={{
                          background: "rgba(130,71,229,0.25)",
                          border: "1px solid rgba(130,71,229,0.5)",
                          fontWeight: 600,
                        }}
                      >
                        → Polygon
                      </button>
                      <button
                        onClick={() => handleReverseBridge("56")}
                        disabled={bridgingDir !== null}
                        className="py-2 rounded-xl text-xs text-white disabled:opacity-50"
                        style={{
                          background: "rgba(240,185,11,0.25)",
                          border: "1px solid rgba(240,185,11,0.5)",
                          fontWeight: 600,
                        }}
                      >
                        → BNB
                      </button>
                      <button
                        onClick={() => navigate("/draws")}
                        className="py-2 rounded-xl text-xs text-white"
                        style={{
                          background: "rgba(255,255,255,0.1)",
                          border: "1px solid rgba(255,255,255,0.25)",
                          fontWeight: 600,
                        }}
                      >
                        Keep INIT
                      </button>
                    </div>
                  </div>
                )}

                {!isWinner && address && (
                  <div className="mt-5 text-center">
                    <div className="text-white/70 text-sm">
                      Better luck next time.
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {draw.status === "CANCELLED" && (
              <div
                className="rounded-3xl p-5 text-white mb-4 text-center"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                }}
              >
                <div className="text-sm" style={{ fontWeight: 600 }}>
                  Draw cancelled
                </div>
                <div className="text-white/70 text-xs mt-1">
                  Deposits were refunded to each player's Initia wallet.
                </div>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => navigate("/draws")}
          className="w-full py-3 rounded-xl text-white/70 text-sm"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          ← Back to lobby
        </button>
      </div>
    </div>
  );
}
