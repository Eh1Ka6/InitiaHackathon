import { useParams, useNavigate } from "react-router-dom";
import { useWager } from "../hooks/useWager";
import { useTelegram } from "../hooks/useTelegram";
import { useDeposit } from "../hooks/useDeposit";
import { useInterwovenKit } from "../lib/interwovenkit-stub";
import { api } from "../services/api";
import BridgeButton from "../components/BridgeButton";
import WinnerScreen from "../components/WinnerScreen";

export default function WagerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useTelegram();
  const { data: wager, isLoading } = useWager(Number(id));
  const { isConnected, connect } = useInterwovenKit();

  if (isLoading || !wager) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--hint)]">Loading...</div>;
  }

  if (wager.status === "SETTLED") {
    return <WinnerScreen wager={wager} />;
  }

  const myEntry = wager.entries?.find((e: any) => e.user.telegramId === user?.id?.toString());
  const opponent = wager.entries?.find((e: any) => e.user.telegramId !== user?.id?.toString());

  return (
    <WagerDetailInner
      wager={wager}
      myEntry={myEntry}
      opponent={opponent}
      user={user}
      navigate={navigate}
      isConnected={isConnected}
      connect={connect}
    />
  );
}

function WagerDetailInner({
  wager,
  myEntry,
  opponent,
  user,
  navigate,
  isConnected,
  connect,
}: {
  wager: any;
  myEntry: any;
  opponent: any;
  user: any;
  navigate: any;
  isConnected: boolean;
  connect: () => Promise<void>;
}) {
  const { deposit, loading: depositLoading, error: depositError } = useDeposit(
    wager.id,
    wager.entryFee
  );

  const handleDeposit = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    const txHash = await deposit();
    if (txHash && user?.id) {
      try {
        await api.fundWager(wager.id, txHash, user.id.toString());
      } catch (err) {
        console.error("[WagerDetail] fundWager API error:", err);
      }
    }
  };

  const showDepositButton =
    (wager.status === "ACCEPTED" || wager.status === "FUNDING") && myEntry && !myEntry.funded;

  return (
    <div className="p-4 min-h-screen">
      <div className="bg-[var(--secondary-bg)] rounded-2xl p-5 mb-4">
        <div className="text-xs text-[var(--hint)] uppercase tracking-wider">Wager #{wager.id}</div>
        <div className="text-xl font-bold mt-1">{wager.entryFee} INIT each</div>
        <div className="text-sm text-[var(--hint)] mt-1">{wager.description}</div>

        <div className="mt-4 flex justify-between">
          <div>
            <div className="text-xs text-[var(--hint)]">Creator</div>
            <div className="text-sm">{wager.creator?.firstName}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--hint)]">Opponent</div>
            <div className="text-sm">{opponent?.user?.firstName || "Waiting..."}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs text-[var(--hint)] uppercase">Status</div>
          <div className="text-sm font-semibold mt-1">{wager.status}</div>
        </div>
      </div>

      {/* Deposit button */}
      {showDepositButton && (
        <div className="mb-4">
          <button
            onClick={handleDeposit}
            disabled={depositLoading}
            className="w-full py-3 rounded-xl text-[var(--btn-text)] font-semibold disabled:opacity-50"
            style={{ background: "var(--btn)" }}
          >
            {depositLoading
              ? "Processing..."
              : !isConnected
                ? "Connect Wallet to Deposit"
                : `Deposit ${wager.entryFee} INIT`}
          </button>
          {depositError && (
            <div className="text-red-400 text-xs mt-2 text-center">{depositError}</div>
          )}
        </div>
      )}

      {(wager.status === "PLAYING" || wager.status === "FUNDED") && (
        <button
          onClick={() => navigate(`/play/${wager.id}`)}
          className="w-full py-3 rounded-xl text-black font-bold text-lg"
          style={{ background: "linear-gradient(135deg, #40C4FF, #A855F7, #FF4D6D)" }}
        >
          🎮 Play Stack
        </button>
      )}

      {wager.status === "PENDING_ACCEPTANCE" && (
        <div className="text-center text-[var(--hint)] py-4">Waiting for opponent to accept...</div>
      )}

      <div className="mt-4">
        <BridgeButton />
      </div>
    </div>
  );
}
