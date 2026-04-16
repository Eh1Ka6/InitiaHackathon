import { useState } from "react";
import { useInterwovenKit } from "../lib/interwovenkit-stub";
import { CONTRACTS, CHAIN_CONFIG } from "../lib/constants";

export function useDeposit(competitionId: number, entryFee: string) {
  const { requestTxSync, autoSign, address } = useInterwovenKit();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = async (): Promise<string | null> => {
    if (!address) {
      setError("Wallet not connected");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Enable auto-signing for the chain so the user doesn't need to confirm each tx
      const chainId = CHAIN_CONFIG.chainId;
      if (!autoSign.isEnabledByChain[chainId]) {
        await autoSign.enable(chainId, { duration: 3600 });
      }

      // Call WeezWager.enter() via requestTxSync
      const { txHash } = await requestTxSync({
        chainId,
        messages: [
          {
            typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
            value: {
              sender: address,
              contract: CONTRACTS.WAGER,
              msg: JSON.stringify({
                enter: {
                  competition_id: competitionId,
                },
              }),
              funds: [
                {
                  denom: "uinit",
                  amount: String(Math.floor(parseFloat(entryFee) * 1_000_000)),
                },
              ],
            },
          },
        ],
      });

      return txHash;
    } catch (err: any) {
      const message = err?.message || "Deposit failed";
      setError(message);
      console.error("[useDeposit] Error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { deposit, loading, error };
}
