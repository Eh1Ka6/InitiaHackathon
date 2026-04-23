import BridgeButton from "../components/BridgeButton";

export default function Bridge() {
  return (
    <div className="p-4 min-h-screen flex flex-col items-center justify-center">
      <div className="text-4xl mb-4">🌉</div>
      <h1 className="text-xl font-bold mb-2">Bridge Funds</h1>
      <p className="text-sm text-[var(--hint)] text-center mb-6">
        Bridge assets from Polygon, BNB Chain, or other chains to your WeezDraw appchain.
      </p>
      <div className="w-full max-w-xs">
        <BridgeButton />
      </div>
    </div>
  );
}
