import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/constants";

type AccountStatus = "active" | "pending" | "inactive" | string;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  accountStatus: AccountStatus | null;
  mustChangePassword: boolean;
  loading: boolean;
  configError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type RoleFetch = { role: AppRole | null; failed: boolean };

async function fetchRole(userId: string): Promise<RoleFetch> {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Failed to fetch role:", error);
    return { role: null, failed: true };
  }
  return { role: (data?.role as AppRole | undefined) ?? null, failed: false };
}

async function fetchMustChangePassword(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("users")
    .select("must_change_password")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.must_change_password);
}

async function fetchAccountStatus(
  userId: string,
  role: AppRole,
  email: string | undefined,
): Promise<AccountStatus> {
  try {
    if (role === "admin") return "active";

    if (role === "employee") {
      const { data } = await supabase
        .from("employees")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();
      return data?.status ?? "active";
    }

    let { data } = await supabase.from("students").select("status").eq("user_id", userId).maybeSingle();
    if (!data && email) {
      const byEmail = await supabase.from("students").select("status").eq("email", email).maybeSingle();
      data = byEmail.data;
    }
    return data?.status ?? "pending";
  } catch (err) {
    console.error("Error fetching account status:", err);
    return "active";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const loadIdRef = useRef(0);
  const roleRef = useRef<AppRole | null>(null);
  roleRef.current = role;
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    const loadId = ++loadIdRef.current;

    if (!nextSession?.user) {
      setRole(null);
      setAccountStatus(null);
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    if (!roleRef.current) setLoading(true);

    let fetched: RoleFetch = { role: null, failed: true };
    for (let attempt = 0; attempt < 2; attempt++) {
      fetched = await fetchRole(nextSession.user.id);
      if (loadId !== loadIdRef.current) return;
      if (!fetched.failed) break;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 250));
    }

    if (loadId !== loadIdRef.current) return;

    if (fetched.failed) {
      // Transient error (common inside onAuthStateChange / token refresh). Keep any
      // role we already have instead of wiping it and hanging on "Resolving your role".
      setLoading(false);
      return;
    }

    const [status, forcePw] = await Promise.all([
      fetched.role
        ? fetchAccountStatus(nextSession.user.id, fetched.role, nextSession.user.email ?? undefined)
        : Promise.resolve(null),
      fetchMustChangePassword(nextSession.user.id),
    ]);

    if (loadId !== loadIdRef.current) return;

    setRole(fetched.role);
    setAccountStatus(status);
    setMustChangePassword(forcePw);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConfigError(
        "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel → Settings → Environment Variables, then redeploy.",
      );
      setLoading(false);
      return;
    }

    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      // Never refetch profile on token refresh — a failed query here used to overwrite
      // a valid role with null and leave employees stuck on "Resolving your role…".
      if (event === "TOKEN_REFRESHED") return;

      // Defer so we don't query PostgREST while the GoTrue client lock is held.
      const timer = setTimeout(() => {
        if (mounted) void loadProfile(nextSession);
      }, 0);
      timers.push(timer);
    });

    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    loadIdRef.current += 1;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setAccountStatus(null);
    setMustChangePassword(false);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(sessionRef.current);
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      session,
      user,
      role,
      accountStatus,
      mustChangePassword,
      loading,
      configError,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      session,
      user,
      role,
      accountStatus,
      mustChangePassword,
      loading,
      configError,
      signIn,
      signOut,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
