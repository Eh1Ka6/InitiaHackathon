import { useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useWager } from "../hooks/useWager";
import { useTelegram } from "../hooks/useTelegram";
import { api } from "../services/api";
import StackGame from "../game/StackGame";
import GameHeader from "../components/GameHeader";
import WinnerScreen from "../components/WinnerScreen";
import WaitingScreen from "../components/WaitingScreen";

export default function GameScreen() {
  const { id } = useParams();
  const location = useLocation();
  const isFreeMode = location.pathname.startsWith("/play-free/");

  const { data: wager, isLoading } = useWager(isFreeMode ? 0 : Number(id));
  const { user } = useTelegram();
  const [hasPlayed, setHasPlayed] = useState(false);
  const [gameStartTime] = useState(Date.now());
  const [localScore, setLocalScore] = useState<number | null>(null);

  const handleGameOver = async (score: number) => {
    setHasPlayed(true);
    setLocalScore(score);
    if (isFreeMode) return;
    const playTimeMs = Date.now() - gameStartTime;
    try {
      await api.submitScore(
        Number(id),
        score,
        playTimeMs,
        user?.id?.toString() || ""
      );
    } catch (err) {
      console.error("Score submission failed:", err);
    }
  };

  // Free game mode
  if (isFreeMode) {
    return (
      <div className="flex flex-col min-h-screen bg-[#02020e]">
        <div className="p-3 text-center">
          <div className="text-xs text-white/50 uppercase tracking-widest">
            Free Practice
          </div>
          {hasPlayed && (
            <div className="text-xl font-bold text-white mt-1">
              Final Score: {localScore}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <StackGame
            gameSeed="free-practice"
            onGameOver={handleGameOver}
            disabled={false}
          />
        </div>
      </div>
    );
  }

  if (isLoading || !wager) {
    return (
      <div className="flex items-center justify-center min-h-screen text-[var(--hint)]">
        Loading...
      </div>
    );
  }

  if (wager.status === "SETTLED") {
    return <WinnerScreen wager={wager} />;
  }

  const myEntry = wager.entries?.find(
    (e: any) => e.user.telegramId === user?.id?.toString()
  );
  const opponentEntry = wager.entries?.find(
    (e: any) => e.user.telegramId !== user?.id?.toString()
  );

  if (hasPlayed || (myEntry?.score !== null && myEntry?.score !== undefined)) {
    return (
      <WaitingScreen
        wager={wager}
        myScore={myEntry?.score}
        opponentEntry={opponentEntry}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <GameHeader wager={wager} />
      <div className="flex-1 flex items-center justify-center">
        <StackGame
          gameSeed={wager.gameSeed || "default-seed"}
          onGameOver={handleGameOver}
          wagerAmount={wager.entryFee}
          opponentScore={opponentEntry?.score}
        />
      </div>
    </div>
  );
}
