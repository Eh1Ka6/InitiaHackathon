import { useState } from "react";
import { useParams } from "react-router-dom";
import { useWager } from "../hooks/useWager";
import { useTelegram } from "../hooks/useTelegram";
import { api } from "../services/api";
import StackGame from "../game/StackGame";
import GameHeader from "../components/GameHeader";
import WinnerScreen from "../components/WinnerScreen";
import WaitingScreen from "../components/WaitingScreen";

export default function GameScreen() {
  const { id } = useParams();
  const { data: wager, isLoading } = useWager(Number(id));
  const { user } = useTelegram();
  const [hasPlayed, setHasPlayed] = useState(false);
  const [gameStartTime] = useState(Date.now());

  const handleGameOver = async (score: number) => {
    setHasPlayed(true);
    const playTimeMs = Date.now() - gameStartTime;
    try {
      await api.submitScore(Number(id), score, playTimeMs);
    } catch (err) {
      console.error("Score submission failed:", err);
    }
  };

  if (isLoading || !wager) {
    return <div className="flex items-center justify-center min-h-screen text-[var(--hint)]">Loading...</div>;
  }

  if (wager.status === "SETTLED") {
    return <WinnerScreen wager={wager} />;
  }

  const myEntry = wager.entries?.find((e: any) => e.user.telegramId === user?.id?.toString());
  const opponentEntry = wager.entries?.find((e: any) => e.user.telegramId !== user?.id?.toString());

  // Already played
  if (hasPlayed || (myEntry?.score !== null && myEntry?.score !== undefined)) {
    return <WaitingScreen wager={wager} myScore={myEntry?.score} opponentEntry={opponentEntry} />;
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
