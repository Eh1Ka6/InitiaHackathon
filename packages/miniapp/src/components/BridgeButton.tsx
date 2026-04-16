export default function BridgeButton() {
  const handleBridge = () => {
    // TODO: InterwovenKit openBridge() integration
    // For now, show alert
    window.Telegram?.WebApp?.showAlert("Bridge integration coming soon! Use Interwoven Bridge to deposit from Polygon or BNB Chain.");
  };

  return (
    <button
      onClick={handleBridge}
      className="w-full py-3 rounded-xl border border-[var(--link)] text-[var(--link)] text-sm font-medium"
    >
      🌉 Bridge Funds (Polygon / BNB)
    </button>
  );
}
