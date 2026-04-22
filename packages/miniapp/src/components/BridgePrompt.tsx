import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useInterwovenKit } from "../lib/interwovenkit-stub";
import { useBridgeStatus } from "../hooks/useBridgeStatus";

interface Props {
  /**
   * Amount of INIT the user needs on Initia (entry fee + small gas buffer).
   * String to avoid BigNumber issues.
   */
  targetAmount: string;
  /** Fires when the Initia balance on the user's wallet reaches targetAmount. */
  onBridgeComplete?: (finalBalance: string) => void;
}

function chainLabel(chainId: string): { name: string; nativeToken: string } {
  switch (chainId) {
    case "137":
      return { name: "Polygon", nativeToken: "MATIC" };
    case "56":
      return { name: "BNB Chain", nativeToken: "BNB" };
    case "1":
      return { name: "Ethereum", nativeToken: "ETH" };
    default:
      return { name: `Chain ${chainId}`, nativeToken: "native token" };
  }
}

export default function BridgePrompt({ targetAmount, onBridgeComplete }: Props) {
  const { chainId, openBridge, openBridgeReal } = useInterwovenKit();
  const { status, currentBalance, start } = useBridgeStatus(targetAmount);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { name, nativeToken } = chainLabel(chainId);

  useEffect(() => {
    if (status === "complete") {
      onBridgeComplete?.(currentBalance);
    }
  }, [status, currentBalance, onBridgeComplete]);

  const handleBridgeNow = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const details = {
        srcChainId: chainId,
        srcDenom: "native",
        dstChainId: "interwoven-1",
        dstDenom: "uinit",
        amount: targetAmount,
      };
      const useReal = import.meta.env.VITE_USE_REAL_BRIDGE === "true";
      if (useReal) {
        await openBridgeReal(details);
      } else {
        await openBridge(details);
      }
      // Start polling regardless — balance will arrive async
      start();
    } catch (err: any) {
      setError(err?.message || "Bridge failed or was cancelled");
    } finally {
      setSubmitting(false);
    }
  };

  const pct = (() => {
    const t = parseFloat(targetAmount || "0");
    const c = parseFloat(currentBalance || "0");
    if (t <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl p-6"
      style={{
        fontFamily: "var(--font-sequel-sans)",
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.3)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.35), 0 20px 60px rgba(0,0,0,0.35)",
        color: "#fff",
      }}
    >
      <div
        className="text-white/60 text-[10px] uppercase tracking-[0.35em] mb-2"
        style={{ fontWeight: 500 }}
      >
        Bridge Required
      </div>
      <h2
        className="text-2xl mb-1"
        style={{ fontWeight: 600, letterSpacing: "-0.5px" }}
      >
        You're on {name}.
      </h2>
      <p className="text-white/70 text-sm mb-5">
        Bridge your {nativeToken} to Initia to play this draw. Funds arrive as
        INIT on your Initia wallet.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div className="text-white/60 text-[10px] uppercase tracking-widest">
            Target
          </div>
          <div className="text-white text-lg mt-1" style={{ fontWeight: 600 }}>
            {targetAmount} INIT
          </div>
        </div>
        <div
          className="rounded-2xl p-3"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          <div className="text-white/60 text-[10px] uppercase tracking-widest">
            Current
          </div>
          <div className="text-white text-lg mt-1" style={{ fontWeight: 600 }}>
            {currentBalance} INIT
          </div>
        </div>
      </div>

      {status !== "idle" && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span>
              {status === "pending" && "Waiting for funds on Initia…"}
              {status === "complete" && "Bridge complete"}
              {status === "error" && "Timed out — try again"}
            </span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  status === "error"
                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                    : "linear-gradient(90deg, #40C4FF, #A855F7)",
              }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-red-300 text-xs mb-3 text-center">{error}</div>
      )}

      <button
        onClick={handleBridgeNow}
        disabled={submitting || status === "pending" || status === "complete"}
        className="w-full py-3 rounded-xl text-white disabled:opacity-60"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))",
          border: "1px solid rgba(255,255,255,0.4)",
          fontWeight: 700,
          letterSpacing: "-0.5px",
          fontSize: "1rem",
        }}
      >
        {status === "pending"
          ? "Bridging…"
          : status === "complete"
            ? "Bridged ✓"
            : "Bridge Now"}
      </button>

      <div className="text-center mt-3 text-[10px] text-white/40">
        Powered by Interwoven Bridge. Typical finality: 1-3 minutes.
      </div>
    </motion.div>
  );
}
