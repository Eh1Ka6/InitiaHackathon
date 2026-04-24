import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Minimal top-level error boundary. Prevents any render-time exception —
 * notably the InterwovenKit router "URL not found" — from white-screening
 * the whole app. Shows the error text and a "reload" button so the user
 * can recover without killing the Telegram WebView session.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 20,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background:
              "linear-gradient(180deg,#013f88 0%,#1c5199 50%,#5586c1 100%)",
            color: "#fff",
            fontFamily: "var(--font-sequel-sans)",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div
            style={{
              fontSize: 12,
              opacity: 0.7,
              maxWidth: 320,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            {this.state.error.message || String(this.state.error)}
          </div>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.hash = "#/";
              window.location.reload();
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
