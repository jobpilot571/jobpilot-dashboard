import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

async function fetchRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).maybeSingle();
  if (error) {
    console.error("Failed to fetch role:", error);
    return null;
  }
  return (data?.role as AppRole | undefined) ?? null;
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

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setRole(null);
      setAccountStatus(null);
      setMustChangePassword(false);
      setLoading(false);
      return;
    }

    const fetchedRole = await fetchRole(nextSession.user.id);
    const [status, forcePw] = await Promise.all([
      fetchedRole
        ? fetchAccountStatus(nextSession.user.id, fetchedRole, nextSession.user.email ?? undefined)
        : Promise.resolve(null),
      fetchMustChangePassword(nextSession.user.id),
    ]);

    setRole(fetchedRole);
    setAccountStatus(status);
    setMustChangePassword(forcePw);
    setLoading(false);
  }, []);

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setConfigError("Missing Supabase configuration. Check your .env file.");
      setLoading(false);
      return;
    }

    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      void loadProfile(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!mounted) return;
      setSession(existing);
      setUser(existing?.user ?? null);
      void loadProfile(existing);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRole(null);
    setAccountStatus(null);
    setMustChangePassword(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

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
