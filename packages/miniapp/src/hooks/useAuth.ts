import { useState, useEffect } from "react";
import { useTelegram } from "./useTelegram";
import { api } from "../services/api";

export function useAuth() {
  const { initData, user } = useTelegram();
  const [jwt, setJwt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!initData) {
      setLoading(false);
      return;
    }

    api
      .login(initData)
      .then(({ token }) => {
        setJwt(token);
        api.setAuthToken(token);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [initData]);

  return { jwt, user, isAuthenticated: !!jwt, loading };
}
