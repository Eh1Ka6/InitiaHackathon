import { useEffect } from "react";

export function useTelegram() {
  const webApp = window.Telegram?.WebApp;

  useEffect(() => {
    webApp?.ready();
    webApp?.expand();
  }, []);

  return {
    webApp,
    user: webApp?.initDataUnsafe?.user,
    startParam: webApp?.initDataUnsafe?.start_param,
    initData: webApp?.initData,
    colorScheme: webApp?.colorScheme,
    close: () => webApp?.close(),
    mainButton: webApp?.MainButton,
    backButton: webApp?.BackButton,
    showAlert: (msg: string) => webApp?.showAlert(msg),
  };
}
