import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BridgeTransferDetails } from "../lib/interwovenkit-stub";

interface Props {
  details: BridgeTransferDetails;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

function labelFor(chainId: string): string {
  switch (chainId) {
    case "137":
      return "Polygon";
    case "56":
      return "BNB Chain";
    case "interwoven-1":
      return "Initia";
    default:
      return `Chain ${chainId}`;
  }
}

function denomLabel(chainId: string, denom: string): string {
  if (chainId === "interwoven-1") return "INIT";
  if (chainId === "137") return "MATIC";
  if (chainId === "56") return "BNB";
  return denom || "native";
}

export default function BridgeModal({ details, onConfirm, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      // keep spinner visible; provider unmounts the modal on resolve
    }
  };

  const srcLabel = labelFor(details.srcChainId);
  const dstLabel = labelFor(details.dstChainId);
  const srcToken = denomLabel(details.srcChainId, details.srcDenom);
  const dstToken = denomLabel(details.dstChainId, details.dstDenom);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[420px] rounded-t-3xl sm:rounded-3xl p-6"
          style={{
            fontFamily: "var(--font-sequel-sans)",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.3)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.35), 0 30px 80px rgba(0,0,0,0.45)",
            color: "#fff",
          }}
        >
          <div className="w-12 h-1 bg-white/30 rounded-full mx-auto mb-4 sm:hidden" />

          <div
            className="text-white/60 text-[10px] uppercase tracking-[0.35em] text-center mb-2"
            style={{ fontWeight: 500 }}
          >
            Interwoven Bridge
          </div>
          <h2
            className="text-center text-2xl mb-6"
            style={{ fontWeight: 600, letterSpacing: "-0.5px" }}
          >
            Bridge to Initia
          </h2>

          {/* Route visualization */}
          <div className="flex items-center justify-between mb-5">
            <div
              className="flex-1 rounded-2xl p-3 text-center"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div className="text-white/60 text-[10px] uppercase tracking-widest">
                From
              </div>
              <div className="text-white text-sm font-semibold mt-1">
                {srcLabel}
              </div>
              <div className="text-white/50 text-xs mt-0.5">{srcToken}</div>
            </div>
            <div className="px-3 text-white/50 text-xl">→</div>
            <div
              className="flex-1 rounded-2xl p-3 text-center"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div className="text-white/60 text-[10px] uppercase tracking-widest">
                To
              </div>
              <div className="text-white text-sm font-semibold mt-1">
                {dstLabel}
              </div>
              <div className="text-white/50 text-xs mt-0.5">{dstToken}</div>
            </div>
          </div>

          <div
            className="rounded-2xl p-4 mb-5"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Amount</span>
              <span className="text-white font-semibold">
                {details.amount} {dstToken}
              </span>
            </div>
            <div className="flex justify-between text-xs mt-2">
              <span className="text-white/40">Estimated time</span>
              <span className="text-white/70">~1-3 minutes</span>
            </div>
          </div>

          {confirming ? (
            <div className="text-center py-3">
              <motion.div
                className="inline-block w-8 h-8 rounded-full border-2 border-white/30 border-t-white mb-3"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              />
              <div className="text-white/70 text-sm">
                Bridging… keep this tab open
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={handleConfirm}
                className="w-full py-3 rounded-xl text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))",
                  border: "1px solid rgba(255,255,255,0.4)",
                  fontWeight: 700,
                  letterSpacing: "-0.5px",
                  fontSize: "1rem",
                }}
              >
                Confirm Bridge
              </button>
              <button
                onClick={onCancel}
                className="w-full py-3 rounded-xl text-white/70 text-sm"
                style={{ border: "1px solid rgba(255,255,255,0.12)" }}
              >
                Cancel
              </button>
            </div>
          )}

          <div className="text-center mt-3 text-[10px] text-white/40">
            Stubbed bridge — real Interwoven Bridge integration swaps in later.
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
