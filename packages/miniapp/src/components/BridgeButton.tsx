import { useInterwovenKit } from "../lib/interwovenkit-stub";

export default function BridgeButton() {
  const { openBridgeLegacy } = useInterwovenKit();

  return (
    <button
      onClick={openBridgeLegacy}
      className="w-full py-3 rounded-xl border border-[var(--link)] text-[var(--link)] text-sm font-medium"
    >
      🌉 Bridge Funds (Polygon / BNB)
    </button>
  );
}
