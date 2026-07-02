import { createRoot } from "react-dom/client";
import React from "react";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message ?? "未知错误" };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#f8fafc", fontFamily: "sans-serif" }}>
          <p style={{ color: "#64748b", fontSize: 14 }}>页面加载出错，请刷新重试</p>
          <p style={{ color: "#94a3b8", fontSize: 12 }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "8px 20px", borderRadius: 8, background: "#1d4ed8", color: "#fff", border: "none", cursor: "pointer", fontSize: 14 }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
