import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "../hooks/useTelegram";
import { useUserWagers } from "../hooks/useWager";
import { useInterwovenKit, useUsernameQuery } from "../lib/interwovenkit-stub";
import SwipeluxModal from "../components/SwipeluxModal";
import "../styles/profile.css";

function truncate(addr: string): string {
  return addr.slice(0, 12) + "..." + addr.slice(-6);
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const { address, disconnect, isConnected } = useInterwovenKit();
  const { data: username } = useUsernameQuery(address);
  const { data: wagers } = useUserWagers(user?.id?.toString() || "");
  const [copied, setCopied] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showSwipelux, setShowSwipelux] = useState(false);

  const wins =
    wagers?.filter(
      (w: any) =>
        w.status === "SETTLED" &&
        w.winnerId &&
        user &&
        w.winner?.telegramId === user.id?.toString()
    ).length || 0;

  const walletLabel = address
    ? username
      ? `${username}.init`
      : truncate(address)
    : "Not connected";

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main className="profile-page">
      <div className="profile-container">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-card-image">
            <div className="avatar-placeholder">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 512"
                fill="currentColor"
                style={{ width: 80, height: 80, opacity: 0.6 }}
              >
                <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z" />
              </svg>
            </div>
          </div>
          <div className="profile-card-info">
            <div className="profile-card-name">
              <h2>{user?.first_name || "Player"}</h2>
              <span>#{user?.id ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* Wallet Address */}
        <div className="wallet-address">
          <span>{walletLabel}</span>
          <button onClick={copyAddress} title={copied ? "Copied!" : "Copy"}>
            {copied ? "✓" : "⧉"}
          </button>
        </div>

        {/* Balances */}
        <div className="balances-section">
          <div className="balances-header">
            <h3>Balances</h3>
          </div>
          <div className="balances-cards">
            <div className="balance-card">
              <div className="balance-card-label">
                <span>Winnings</span>
              </div>
              <div className="balance-card-value">${wins * 10}</div>
            </div>
            <div className="balance-card">
              <div className="balance-card-label">
                <span>INIT</span>
              </div>
              <div className="balance-card-value">--</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="profile-actions">
          <button className="btn-withdraw" disabled>
            Withdraw
          </button>
          <button
            className="btn-deposit"
            onClick={() => setShowDeposit(!showDeposit)}
          >
            {showDeposit ? "Hide" : "Deposit"}
          </button>
        </div>

        {showDeposit && (
          <div className="deposit-section">
            <div className="deposit-tabs">
              <button
                className="deposit-tab active"
                onClick={() => setShowSwipelux(true)}
              >
                ↗ Swipelux
              </button>
              <button className="deposit-tab" disabled>
                💳 Card
              </button>
              <button className="deposit-tab" disabled>
                ₿ Crypto
              </button>
            </div>
            <div
              style={{
                padding: 16,
                textAlign: "center",
                color: "#003e89",
                fontSize: 13,
              }}
            >
              Tap Swipelux to open the onramp and buy INIT with card.
            </div>
          </div>
        )}

        {/* My Tickets */}
        <div className="tickets-section">
          <div className="tickets-header">
            <h3>My Tickets</h3>
          </div>
          <div className="ticket-stack">
            {!wagers?.length ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "2rem 1rem",
                  color: "#003e89",
                  opacity: 0.4,
                  fontSize: 13,
                }}
              >
                No tickets yet — head back to Cash Game to enter a draw.
              </div>
            ) : (
              wagers.slice(0, 5).map((wager: any) => (
                <div
                  key={wager.id}
                  className="ticket-card"
                  onClick={() => navigate(`/wager/${wager.id}`)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="ticket-card-header">
                    <span className="ticket-card-draw-title">
                      {wager.description || "Stack Game"}
                    </span>
                    <span
                      className={`ticket-card-status status-${wager.status?.toLowerCase()}`}
                    >
                      {wager.status}
                    </span>
                  </div>
                  <div className="ticket-progress">
                    <div className="ticket-progress-bar">
                      <div
                        className="ticket-progress-fill"
                        style={{
                          width:
                            wager.status === "SETTLED"
                              ? "100%"
                              : wager.status === "PLAYING"
                              ? "75%"
                              : wager.status === "FUNDED"
                              ? "50%"
                              : "25%",
                        }}
                      />
                    </div>
                  </div>
                  <div className="ticket-card-body">
                    <div className="ticket-card-field">
                      <label>Ticket Price</label>
                      <span>{wager.entryFee} INIT</span>
                    </div>
                    <div className="ticket-card-field">
                      <label>ID</label>
                      <span>#{wager.id?.toString().padStart(6, "0")}</span>
                    </div>
                  </div>
                  <div className="ticket-card-prize">
                    <span className="ticket-card-prize-amount">
                      {(parseFloat(wager.entryFee || "0") * 2 * 0.98).toFixed(0)}{" "}
                      INIT
                    </span>
                  </div>
                  <span className="ticket-card-prize-note">Current prize</span>
                  <button
                    className="ticket-card-enter"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/wager/${wager.id}`);
                    }}
                  >
                    <span>Enter the draw</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {isConnected && (
          <button
            onClick={disconnect}
            style={{
              marginTop: 16,
              padding: "12px",
              width: "100%",
              background: "transparent",
              border: "1px solid rgba(0,62,137,0.15)",
              borderRadius: 12,
              color: "#003e89",
              opacity: 0.6,
              fontFamily: "var(--font-sequel-sans)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        )}
      </div>

      {showSwipelux && <SwipeluxModal onClose={() => setShowSwipelux(false)} />}
    </main>
  );
}
