interface TelegramWebApp {
  ready(): void;
  expand(): void;
  close(): void;
  initData: string;
  initDataUnsafe: {
    user?: { id: number; username?: string; first_name: string; last_name?: string };
    start_param?: string;
    auth_date: number;
    hash: string;
  };
  colorScheme: "light" | "dark";
  MainButton: {
    text: string;
    isVisible: boolean;
    setText(text: string): void;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
  };
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  showAlert(message: string): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
