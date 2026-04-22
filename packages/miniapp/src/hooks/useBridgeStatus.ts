import { useCallback, useEffect, useRef, useState } from "react";
import { useInterwovenKit } from "../lib/interwovenkit-stub";

export type BridgeStatus = "idle" | "pending" | "complete" | "error";

export interface UseBridgeStatusResult {
  status: BridgeStatus;
  currentBalance: string;
  start: () => void;
  reset: () => void;
}

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Polls the connected Initia wallet balance until it reaches targetAmount.
 *
 * @param targetAmount INIT amount as a string (decimal units, e.g. "1.1")
 * @param pollIntervalMs poll cadence
 */
export function useBridgeStatus(
  targetAmount: string,
  pollIntervalMs = 5000
): UseBridgeStatusResult {
  const { address, getInitiaBalance } = useInterwovenKit();
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [currentBalance, setCurrentBalance] = useState<string>("0");

  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const target = parseFloat(targetAmount || "0");

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    if (cancelledRef.current) return;
    try {
      const bal = await getInitiaBalance(address);
      setCurrentBalance(bal);
      const n = parseFloat(bal || "0");
      if (!Number.isNaN(n) && n >= target && target > 0) {
        setStatus("complete");
        clearTimer();
        return;
      }
      if (
        startedAtRef.current !== null &&
        Date.now() - startedAtRef.current > TIMEOUT_MS
      ) {
        setStatus("error");
        clearTimer();
        return;
      }
      timerRef.current = window.setTimeout(poll, pollIntervalMs);
    } catch (err) {
      console.error("[useBridgeStatus] poll failed", err);
      timerRef.current = window.setTimeout(poll, pollIntervalMs);
    }
  }, [address, getInitiaBalance, pollIntervalMs, target]);

  const start = useCallback(() => {
    cancelledRef.current = false;
    startedAtRef.current = Date.now();
    setStatus("pending");
    // fire-and-forget; errors handled inside poll
    void poll();
  }, [poll]);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    clearTimer();
    startedAtRef.current = null;
    setStatus("idle");
    setCurrentBalance("0");
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
  }, []);

  return { status, currentBalance, start, reset };
}
