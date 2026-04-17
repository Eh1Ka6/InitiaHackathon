import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInterwovenKit } from "../lib/interwovenkit-stub";
import SwipeluxModal from "./SwipeluxModal";

export default function LoginModal() {
  const { createInitiaWallet, connectWeb3 } = useInterwovenKit();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState<"email" | "initia" | "web3" | null>(null);
  const [email, setEmail] = useState("");
  const [showSwipelux, setShowSwipelux] = useState(false);

  if (dismissed) return null;

  const handleEmailContinue = async () => {
    if (!email) return;
    setLoading("email");
    // For now: email acts like "Create Initia Wallet"
    await createInitiaWallet();
    setLoading(null);
    setDismissed(true);
  };

  const handleInitia = async () => {
    setLoading("initia");
    await createInitiaWallet();
    setLoading(null);
    setDismissed(true);
  };

  const handleWeb3 = async () => {
    setLoading("web3");
    await connectWeb3();
    setLoading(null);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
        }}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="w-full max-w-[420px] rounded-t-3xl sm:rounded-2xl bg-white p-5 shadow-2xl"
          style={{ boxShadow: "0 8px 40px rgba(0,62,137,0.2)" }}
        >
          {/* Handle bar (mobile) */}
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

          <div className="flex justify-between items-center mb-4">
            <h2
              className="text-xl font-bold"
              style={{
                color: "#003e89",
                fontFamily: "'Orbitron', monospace",
              }}
            >
              Sign In
            </h2>
            <button
              onClick={() => setDismissed(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#003e89] text-lg"
              style={{ background: "rgba(0,62,137,0.06)" }}
            >
              ×
            </button>
          </div>

          <div className="text-sm text-gray-500 mb-5">
            Continue to start wagering — no downloads, no friction.
          </div>

          {/* Email */}
          <div className="mb-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl outline-none transition-all"
              style={{
                border: "1.5px solid #dde9f8",
                background: "#f8fafd",
                color: "#003e89",
              }}
            />
          </div>

          <button
            onClick={handleEmailContinue}
            disabled={!email || loading !== null}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "#003e89" }}
          >
            {loading === "email" ? "Creating..." : "Continue with Email"}
          </button>

          {/* Divider */}
          <div className="flex items-center my-4 gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "rgba(0,62,137,0.4)" }}
            >
              Or
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Alternative methods */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleWeb3}
              disabled={loading !== null}
              className="py-2.5 rounded-xl font-semibold text-sm border-2 disabled:opacity-50"
              style={{
                borderColor: "rgba(0,62,137,0.15)",
                color: "#003e89",
              }}
            >
              {loading === "web3" ? "..." : "🔗 Web3"}
            </button>
            <button
              onClick={() => setShowSwipelux(true)}
              disabled={loading !== null}
              className="py-2.5 rounded-xl font-semibold text-sm border-2 disabled:opacity-50"
              style={{ borderColor: "#10b981", color: "#10b981" }}
            >
              💳 Card
            </button>
          </div>

          <button
            onClick={handleInitia}
            disabled={loading !== null}
            className="w-full mt-2 py-2.5 rounded-xl font-semibold text-sm text-white"
            style={{
              background: "linear-gradient(135deg, #40C4FF, #A855F7, #FF4D6D)",
            }}
          >
            {loading === "initia" ? "Creating..." : "✨ Create Initia Wallet (instant)"}
          </button>

          <div className="text-center mt-4 text-[10px] text-gray-400">
            By continuing you agree to our terms of service.
          </div>
        </motion.div>

        {showSwipelux && <SwipeluxModal onClose={() => setShowSwipelux(false)} />}
      </motion.div>
    </AnimatePresence>
  );
}
