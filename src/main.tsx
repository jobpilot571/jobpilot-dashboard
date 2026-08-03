import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "@/components/auth/ErrorBoundary";
import { initNativeShell } from "@/lib/native";
import { bindNativeDeepLinks } from "@/lib/deepLinks";

void initNativeShell();
void bindNativeDeepLinks();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
