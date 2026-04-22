import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "../hooks/useTelegram";
import { useInterwovenKit, useUsernameQuery } from "../lib/interwovenkit-stub";
import SwipeluxModal from "./SwipeluxModal";

interface Slide {
  amount: string;
  ticketPrice: string;
  progress: number;
}

interface Props {
  slide: Slide;
  onClose: () => void;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3002/api";

export default function EnterDrawModal({ slide, onClose }: Props) {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const { address, walletType, createInitiaWallet } = useInterwovenKit();
  const { data: username } = useUsernameQuery(address);
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSwipelux, setShowSwipelux] = useState(false);

  // Check if user already has an email saved
  useEffect(() => {
    if (!user?.id) return;
    fetch(`${BASE}/users/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.email) {
          setSavedEmail(data.email);
          setEmailSubmitted(true);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleCreateProfile = async () => {
    if (!email || !user) return;
    setLoading(true);
    try {
      await fetch(`${BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId: user.id.toString(),
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          email,
        }),
      });
      // Also create a wallet if none
      if (!address) {
        await createInitiaWallet();
      }
      setSavedEmail(email);
      setEmailSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    const slideId = slide.amount.replace(/\D/g, ""); // "10", "50", "500"
    onClose();
    navigate(`/draw-legacy/${slideId}`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 25 }}
          className="w-full max-w-[420px] bg-white rounded-t-3xl sm:rounded-2xl p-5"
          style={{
            boxShadow: "0 8px 40px rgba(0,62,137,0.2)",
            fontFamily: "var(--font-sequel-sans)",
          }}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4 sm:hidden" />

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: emailSubmitted ? "#119BAF" : "#003e89",
                width: !emailSubmitted ? 20 : 8,
              }}
            />
            <div className="w-4 h-px bg-gray-200" />
            <div
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: emailSubmitted ? "#003e89" : "rgba(0,62,137,0.2)",
                width: emailSubmitted ? 20 : 8,
              }}
            />
          </div>

          {!emailSubmitted ? (
            /* STEP 1 — Create Profile */
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2
                className="text-xl mb-1"
                style={{ color: "#003e89", fontWeight: 600 }}
              >
                Create your profile
              </h2>
              <p className="text-sm text-gray-500 mb-5">
                Enter your email to join the {slide.amount} draw. We'll send
                winner notifications here.
              </p>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl outline-none mb-3"
                style={{
                  border: "1.5px solid #dde9f8",
                  background: "#f8fafd",
                  color: "#003e89",
                  fontFamily: "var(--font-sequel-sans)",
                }}
              />

              <button
                onClick={handleCreateProfile}
                disabled={!email || loading}
                className="w-full py-3 rounded-xl text-white transition-all disabled:opacity-50"
                style={{
                  background: "#003e89",
                  fontWeight: 600,
                }}
              >
                {loading ? "Creating..." : "Continue"}
              </button>

              <div className="text-center mt-3 text-[10px] text-gray-400">
                We'll create your Initia wallet automatically.
              </div>
            </motion.div>
          ) : (
            /* STEP 2 — Deposit & Play */
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2
                className="text-xl mb-1"
                style={{ color: "#003e89", fontWeight: 600 }}
              >
                Join the {slide.amount} draw
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Buy a ticket to enter the prize pool. Winner drawn when pool
                fills.
              </p>

              {/* Profile card */}
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: "rgba(0,62,137,0.04)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, #e879f9, #7c3aed, #3b82f6, #06b6d4)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold truncate"
                      style={{ color: "#003e89" }}
                    >
                      {user?.first_name || "Player"}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {savedEmail}
                    </div>
                  </div>
                  {walletType && (
                    <div className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-full bg-black/5 text-gray-500">
                      {walletType}
                    </div>
                  )}
                </div>

                {address && (
                  <div className="mt-3 pt-3 border-t border-black/5 text-xs text-gray-500 font-mono">
                    {username ? `${username}.init` : truncate(address)}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-black/5">
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">
                      Balance
                    </div>
                    <div
                      className="text-lg"
                      style={{ color: "#003e89", fontWeight: 600 }}
                    >
                      -- INIT
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 uppercase">
                      Ticket
                    </div>
                    <div
                      className="text-lg"
                      style={{ color: "#003e89", fontWeight: 600 }}
                    >
                      {slide.ticketPrice}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pool progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Pool {slide.progress}% full</span>
                  <span>Draw soon</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #119BAF 0%, #72DBEA 100%)",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${slide.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={handlePlay}
                  className="w-full py-3 rounded-xl text-white transition-all"
                  style={{
                    background:
                      "linear-gradient(180deg, #119BAF 0%, #0a7a8a 100%)",
                    fontWeight: 700,
                    fontSize: "1rem",
                    letterSpacing: "-0.5px",
                  }}
                >
                  🎟 Buy ticket & Play
                </button>
                <button
                  onClick={() => setShowSwipelux(true)}
                  className="w-full py-3 rounded-xl"
                  style={{
                    background: "#10b98110",
                    color: "#10b981",
                    border: "1px solid #10b98130",
                    fontWeight: 600,
                  }}
                >
                  💳 Deposit with card
                </button>
              </div>
            </motion.div>
          )}

          <button
            onClick={onClose}
            className="w-full mt-3 text-xs text-gray-400"
          >
            Cancel
          </button>
        </motion.div>

        {showSwipelux && <SwipeluxModal onClose={() => setShowSwipelux(false)} />}
      </motion.div>
    </AnimatePresence>
  );
}
