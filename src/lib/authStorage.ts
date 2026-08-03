import { Capacitor } from "@capacitor/core";
import type { SupportedStorage } from "@supabase/supabase-js";

/**
 * Supabase auth storage: Capacitor Preferences on native (survives WebView quirks),
 * localStorage on web.
 */
export function createAuthStorage(): SupportedStorage {
  if (!Capacitor.isNativePlatform()) {
    return localStorage;
  }

  // Lazy Preferences import keeps web bundles clean of native-only paths when tree-shaken,
  // but we still import statically so sessions work as soon as the native shell starts.
  const memory = new Map<string, string>();
  let prefsReady: Promise<typeof import("@capacitor/preferences")> | null = null;

  const getPrefs = () => {
    prefsReady ??= import("@capacitor/preferences");
    return prefsReady;
  };

  return {
    getItem: async (key: string) => {
      if (memory.has(key)) return memory.get(key)!;
      const { Preferences } = await getPrefs();
      const { value } = await Preferences.get({ key });
      if (value != null) memory.set(key, value);
      return value;
    },
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
      const { Preferences } = await getPrefs();
      await Preferences.set({ key, value });
    },
    removeItem: async (key: string) => {
      memory.delete(key);
      const { Preferences } = await getPrefs();
      await Preferences.remove({ key });
    },
  };
}
