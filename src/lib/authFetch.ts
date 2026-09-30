/**
 * Supabase access tokens expire (typically after an hour). A backgrounded tab
 * often misses the auto-refresh tick, so the next save goes out with a dead
 * JWT and PostgREST returns "JWT expired". This fetch refreshes once and retries
 * before the UI treats that as a failed save or an empty application list.
 */

type GetAuthClient = () => {
  auth: {
    refreshSession: () => Promise<{
      data: { session: { access_token: string } | null };
      error: { message: string } | null;
    }>;
    getSession: () => Promise<{
      data: { session: { access_token: string; expires_at?: number } | null };
    }>;
  };
};

const rawFetch = globalThis.fetch.bind(globalThis);
const REFRESH_SKEW_SEC = 60;
const SESSION_EXPIRED = "jobpilot:session-expired";

let getAuthClient: GetAuthClient | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let sessionExpiredNotified = false;

export function bindAuthClient(getter: GetAuthClient) {
  getAuthClient = getter;
}

export function resetAuthFailureNotice() {
  sessionExpiredNotified = false;
}

export function isJwtExpiredMessage(message: string): boolean {
  return /jwt expired|invalid jwt|invalid claim|token (has|is) expired|pgrst301|pgrst303/i.test(message);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isAuthRequest(url: string): boolean {
  return url.includes("/auth/v1/");
}

function bearerFrom(init?: RequestInit): string | null {
  if (!init?.headers) return null;
  const headers = new Headers(init.headers);
  const value = headers.get("Authorization") || headers.get("authorization");
  if (!value?.toLowerCase().startsWith("bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

function withBearer(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

function tokenExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded)) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

function tokenNeedsRefresh(token: string): boolean {
  const exp = tokenExpiry(token);
  if (exp == null) return false;
  const now = Math.floor(Date.now() / 1000);
  return exp - now <= REFRESH_SKEW_SEC;
}

/** The anon API key is also a JWT. Sending it makes RLS return zero rows with no error, which looks like data was deleted. */
function isAnonJwt(token: string): boolean {
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded)) as { role?: string };
    return json.role === "anon";
  } catch {
    return false;
  }
}

function jwtExpiredResponse(): Response {
  return new Response(JSON.stringify({ message: "JWT expired", code: "PGRST303" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

function notifySessionExpired() {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED));
  }
}

export const SESSION_EXPIRED_EVENT = SESSION_EXPIRED;

async function refreshAccessToken(): Promise<string | null> {
  if (!getAuthClient) return null;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const auth = getAuthClient!().auth;
      const { data, error } = await auth.refreshSession();
      const refreshed = data.session?.access_token ?? null;
      if (refreshed && !tokenNeedsRefresh(refreshed)) return refreshed;

      // Another tab may have already rotated the refresh token and stored the new session.
      const stored = await auth.getSession();
      const fallback = stored.data.session?.access_token ?? null;
      if (fallback && !tokenNeedsRefresh(fallback)) return fallback;

      const message = error?.message ?? "";
      if (/refresh token|session not found|invalid refresh|already used/i.test(message)) {
        notifySessionExpired();
      }
      return null;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function responseIsJwtError(response: Response): Promise<boolean> {
  if (response.status !== 401 && response.status !== 403) return false;
  try {
    const body = (await response.clone().json()) as { message?: string; code?: string; error?: string };
    const text = `${body.message ?? ""} ${body.code ?? ""} ${body.error ?? ""}`;
    return isJwtExpiredMessage(text) || response.status === 401;
  } catch {
    return response.status === 401;
  }
}

export function createAuthAwareFetch(): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    if (isAuthRequest(url)) return rawFetch(input, init);

    let nextInit = init;
    const current = bearerFrom(init);
    const restCall = url.includes("/rest/v1/");
    if (current && tokenNeedsRefresh(current)) {
      const fresh = await refreshAccessToken();
      if (fresh) nextInit = withBearer(init, fresh);
    }

    // A lapsed user session falls back to the anon key. That query succeeds and
    // returns nothing, so posted applications disappear from the dashboard.
    if (restCall) {
      const bearer = bearerFrom(nextInit);
      if (!bearer || isAnonJwt(bearer)) {
        const fresh = await refreshAccessToken();
        if (fresh && !isAnonJwt(fresh)) nextInit = withBearer(nextInit, fresh);
        else return jwtExpiredResponse();
      }
    }

    const response = await rawFetch(input, nextInit);
    if (!(await responseIsJwtError(response))) return response;

    const fresh = await refreshAccessToken();
    const alreadySent = bearerFrom(nextInit);
    if (!fresh || fresh === alreadySent) return response;
    return rawFetch(input, withBearer(nextInit, fresh));
  };
}

/** Refresh when the employee comes back to a tab that sat in the background. */
export function installSessionKeepAlive() {
  if (typeof window === "undefined" || !getAuthClient) return;

  const wake = () => {
    if (document.visibilityState === "hidden") return;
    const auth = getAuthClient?.().auth;
    if (!auth) return;
    void auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      const exp = data.session?.expires_at;
      if (!token) return;
      const now = Math.floor(Date.now() / 1000);
      const nearExpiry = exp != null ? exp - now <= REFRESH_SKEW_SEC : tokenNeedsRefresh(token);
      if (nearExpiry) void refreshAccessToken();
    });
  };

  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
}
