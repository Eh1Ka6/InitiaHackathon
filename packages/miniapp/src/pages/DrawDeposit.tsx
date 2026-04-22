import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, type Draw } from "../services/api";
import { useInterwovenKit } from "../lib/interwovenkit-stub";
import BridgePrompt from "../components/BridgePrompt";

const GAS_BUFFER_INIT = 0.1;

export default function DrawDeposit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    address,
    chainId,
    isConnected,
    walletType,
    createInitiaWallet,
    requestTxSync,
    _devSetChainId,
  } = useInterwovenKit();

  const [draw, setDraw] = useState<Draw | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeDone, setBridgeDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getDraw(id)
      .then(setDraw)
      .catch((e) => setError(String(e?.message || e)));
  }, [id]);

  const onInitia = chainId === "interwoven-1";
  const ready = isConnected && (onInitia || bridgeDone);
  const targetAmount = draw
    ? String(parseFloat(draw.entryFeeInit) + GAS_BUFFER_INIT)
    : "0";

  const handleDeposit = async () => {
    if (!draw || !id || !address) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.joinDraw(id, address, chainId);
      // Simulated DrawHub.depositLocal{value: entryFee}(drawId)
      await requestTxSync({
        method: "DrawHub.depositLocal",
        args: [id],
        value: draw.entryFeeInit,
      });
      navigate(`/draw/${id}/play`);
    } catch (err: any) {
      setError(err?.message || "Deposit failed");
    } finally {
      setSubmitting(false);
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
          Enter the Draw
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 mb-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
            }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Entry fee</span>
              <span className="font-semibold">{draw.entryFeeInit} INIT</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-white/60">Players joined</span>
              <span className="font-semibold">
                {draw.participants.length}/{draw.maxParticipants}
              </span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-white/60">Multiplier pool</span>
              <span className="font-semibold">
                Config {draw.multiplierConfigId}
              </span>
            </div>
          </motion.div>
        )}

        {!isConnected && (
          <div
            className="rounded-3xl p-5 mb-4 text-white"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <div
              className="text-white/60 text-[10px] uppercase tracking-[0.35em] mb-2"
              style={{ fontWeight: 500 }}
            >
              Step 1
            </div>
            <div className="text-lg mb-3" style={{ fontWeight: 600 }}>
              Connect your wallet
            </div>
            <button
              onClick={() => createInitiaWallet()}
              className="w-full py-3 rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.08))",
                border: "1px solid rgba(255,255,255,0.4)",
                fontWeight: 700,
              }}
            >
              Create Initia Wallet
            </button>
          </div>
        )}

        {isConnected && !onInitia && !bridgeDone && draw && (
          <BridgePrompt
            targetAmount={targetAmount}
            onBridgeComplete={() => setBridgeDone(true)}
          />
        )}

        {ready && draw && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#fff",
            }}
          >
            <div
              className="text-white/60 text-[10px] uppercase tracking-[0.35em] mb-2"
              style={{ fontWeight: 500 }}
            >
              Ready on Initia
            </div>
            <div className="text-lg mb-3" style={{ fontWeight: 600 }}>
              Deposit {draw.entryFeeInit} INIT
            </div>
            <button
              onClick={handleDeposit}
              disabled={submitting}
              className="w-full py-3 rounded-xl disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.1))",
                border: "1px solid rgba(255,255,255,0.4)",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              {submitting
                ? "Submitting…"
                : `Deposit ${draw.entryFeeInit} INIT`}
            </button>
            <div className="text-white/40 text-[10px] text-center mt-2">
              Wallet type: {walletType || "–"} · chain: {chainId}
            </div>
          </motion.div>
        )}

        {/* Dev helper for testing bridge flow without a real EVM wallet */}
        {import.meta.env.DEV && isConnected && (
          <div className="mt-4 text-center">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">
              Dev: simulate chain
            </div>
            <div className="flex gap-2 justify-center">
              {["137", "56", "interwoven-1"].map((c) => (
                <button
                  key={c}
                  onClick={() => _devSetChainId(c)}
                  className="px-3 py-1 rounded-full text-xs text-white/70"
                  style={{
                    border: "1px solid rgba(255,255,255,0.2)",
                    background:
                      chainId === c
                        ? "rgba(255,255,255,0.15)"
                        : "rgba(255,255,255,0.04)",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate("/draws")}
          className="w-full mt-6 py-3 rounded-xl text-white/70 text-sm"
          style={{ border: "1px solid rgba(255,255,255,0.12)" }}
        >
          ← Back to lobby
        </button>
      </div>
    </div>
  );
}
