import { SwipeluxWidget } from "@swipelux/onramp-react";
import { useInterwovenKit } from "../lib/interwovenkit-stub";

interface Props {
  onClose: () => void;
}

export default function SwipeluxModal({ onClose }: Props) {
  const { address } = useInterwovenKit();
  const apiKey = import.meta.env.VITE_SWIPELUX_KEY || "demo-key";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl overflow-hidden w-full max-w-md max-h-[90vh] overflow-y-auto relative"
      >
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
          <div>
            <div className="font-bold text-black">Buy INIT with Card</div>
            <div className="text-xs text-gray-500">Powered by Swipelux</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-xl font-bold px-2"
          >
            ×
          </button>
        </div>
        <div className="swipelux-wrapper">
          <SwipeluxWidget
            apiKey={apiKey}
            colors={{
              main: "#A855F7",
              background: "#FFFFFF",
              processing: "#A855F7",
              warning: "#ef4444",
              success: "#10b981",
              link: "#40C4FF",
            }}
            signature={{
              text: "Powered by WeezDraw",
              logoUrl: "https://weezdraw.com/images/favicon-wd-transp.png",
            }}
            defaultValues={{
              fiatAmount: 10,
            }}
            availablePayCurrency="USD"
            closeOnSuccess={true}
          />
        </div>
        <div className="p-3 bg-gray-50 text-center text-xs text-gray-500">
          Buy crypto on Polygon, then bridge to Initia for wagering.
        </div>
      </div>
    </div>
  );
}
