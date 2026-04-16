import { useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useTelegram } from "./hooks/useTelegram";
import { useAuth } from "./hooks/useAuth";
import Home from "./pages/Home";
import WagerDetail from "./pages/WagerDetail";
import GameScreen from "./pages/GameScreen";
import PoolView from "./pages/PoolView";
import Bridge from "./pages/Bridge";

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
    }
  }, [startParam]);

  // Back button
  useEffect(() => {
    if (location.pathname !== "/") {
      backButton?.show();
      const handler = () => navigate("/");
      backButton?.onClick(handler);
      return () => backButton?.offClick(handler);
    } else {
      backButton?.hide();
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-[var(--hint)] text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/wager/:id" element={<WagerDetail />} />
      <Route path="/play/:id" element={<GameScreen />} />
      <Route path="/pool/:id" element={<PoolView />} />
      <Route path="/bridge" element={<Bridge />} />
    </Routes>
  );
}
