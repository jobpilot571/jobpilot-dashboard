import { Capacitor } from "@capacitor/core";

export const isNativePlatform = () => Capacitor.isNativePlatform();

export const getPlatform = () => Capacitor.getPlatform();

/** Initialize native shell plugins (safe no-ops on web). */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
  ]);

  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0B1220" });
    }
  } catch (err) {
    console.warn("StatusBar init failed:", err);
  }

  try {
    await SplashScreen.hide();
  } catch (err) {
    console.warn("SplashScreen hide failed:", err);
  }
}
