import { useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useTelegram } from "./hooks/useTelegram";
import { useAuth } from "./hooks/useAuth";
import Splash from "./pages/Splash";
import CashGame from "./pages/CashGame";
import FreeGame from "./pages/FreeGame";
import WagerDetail from "./pages/WagerDetail";
import GameScreen from "./pages/GameScreen";
import PoolView from "./pages/PoolView";
import Bridge from "./pages/Bridge";
import Profile from "./pages/Profile";
import DrawGame from "./pages/DrawGame";

export default function App() {
  const { startParam, backButton } = useTelegram();
  const { loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Route based on startapp param
  useEffect(() => {
    if (!startParam) return;
    if (startParam.startsWith("wager_")) {
      navigate(`/wager/${startParam.replace("wager_", "")}`);
    } else if (startParam.startsWith("play_")) {
      navigate(`/play/${startParam.replace("play_", "")}`);
    } else if (startParam.startsWith("pool_")) {
      navigate(`/pool/${startParam.replace("pool_", "")}`);
    } else if (startParam === "profile") {
      navigate("/profile");
    } else if (startParam === "cash") {
      navigate("/games/cash");
    }
  }, [startParam]);

  // Back button
  useEffect(() => {
    if (location.pathname !== "/") {
      backButton?.show();
      const handler = () => {
        // Smart back: from deep routes go to category root, else home
        if (location.pathname.startsWith("/wager/") || location.pathname.startsWith("/play/")) {
          navigate("/games/cash");
        } else if (location.pathname.startsWith("/pool/")) {
          navigate("/games/cash");
        } else {
          navigate("/");
        }
      };
      backButton?.onClick(handler);
      return () => backButton?.offClick(handler);
    } else {
      backButton?.hide();
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-[var(--hint)] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Splash />} />
      <Route path="/games/cash" element={<CashGame />} />
      <Route path="/games/free" element={<FreeGame />} />
      <Route path="/wager/:id" element={<WagerDetail />} />
      <Route path="/play/:id" element={<GameScreen />} />
      <Route path="/play-free/:gameId" element={<GameScreen />} />
      <Route path="/draw/:slideId" element={<DrawGame />} />
      <Route path="/pool/:id" element={<PoolView />} />
      <Route path="/bridge" element={<Bridge />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  );
}
