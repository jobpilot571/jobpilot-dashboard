import { Capacitor } from "@capacitor/core";

/**
 * Handle Capacitor app URL open events (password reset / magic links).
 * Call once after the React router is mounted is not required — we navigate via location.
 */
export async function bindNativeDeepLinks(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { App } = await import("@capacitor/app");

  App.addListener("appUrlOpen", ({ url }) => {
    try {
      const parsed = new URL(url);
      // Custom scheme: ai.jobpilot.dashboard://reset-password#...
      // Or https deep link path
      const path = parsed.pathname || parsed.hostname;
      const hash = parsed.hash || "";
      const search = parsed.search || "";

      let target = "/";
      if (url.includes("reset-password")) {
        target = `/reset-password${search}${hash}`;
      } else if (path && path !== "/" && path !== "reset-password") {
        target = path.startsWith("/") ? `${path}${search}${hash}` : `/${path}${search}${hash}`;
      } else if (hash) {
        target = `/reset-password${hash}`;
      }

      window.location.assign(target);
    } catch (err) {
      console.warn("Failed to handle deep link:", url, err);
    }
  });
}
