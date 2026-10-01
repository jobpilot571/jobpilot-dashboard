/**
 * Employees keep several dashboard tabs open. Each tab used to refresh the
 * sign-in on its own. Supabase rotates the refresh token, the other tabs
 * lose that race, and the loser wipes the shared session — so everyone is
 * sent to the login page about as often as the access token expires.
 *
 * One visible tab owns the refresh timer. The others read the token it
 * saved. A request never goes out as the anon key, and a lost refresh race
 * does not sign the employee out.
 */

type GetAuthClient = () => {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null };
    }>;
    startAutoRefresh: () => Promise<void>;
    stopAutoRefresh: () => Promise<void>;
  };
};

const rawFetch = globalThis.fetch.bind(globalThis);
const TAB_ID = Math.random().toString(36).slice(2);
const REFRESH_LOCK = "jobpilot:refresh-lock";
const LEADER_KEY = "jobpilot:auth-leader";

let getAuthClient: GetAuthClient | null = null;
let keepAliveInstalled = false;
let leading = false;

export function bindAuthClient(getter: GetAuthClient) {
  getAuthClient = getter;
}

export function resetAuthFailureNotice() {
  /* kept so sign-in can clear any stale notice from older bundles */
}

export function isJwtExpiredMessage(message: string): boolean {
  return /jwt expired|invalid jwt|invalid claim|token (has|is) expired|pgrst301|pgrst303|session expired/i.test(
    message,
  );
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isAuthRequest(url: string): boolean {
  return url.includes("/auth/v1/");
}

function isDataRequest(url: string): boolean {
  return url.includes("/rest/v1/") || url.includes("/storage/v1/") || url.includes("/functions/v1/");
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

function jwtPayload(token: string): { exp?: number; role?: string } | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    let padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const mod = padded.length % 4;
    if (mod) padded += "=".repeat(4 - mod);
    return JSON.parse(atob(padded)) as { exp?: number; role?: string };
  } catch {
    return null;
  }
}

function isAnonJwt(token: string): boolean {
  return jwtPayload(token)?.role === "anon";
}

function tokenIsExpired(token: string): boolean {
  const exp = jwtPayload(token)?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 <= Date.now();
}

function usableToken(token: string | null | undefined): string | null {
  if (!token || isAnonJwt(token) || tokenIsExpired(token)) return null;
  return token;
}

function readStoredAccessToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || "null") as { access_token?: string } | null;
      const token = usableToken(parsed?.access_token);
      if (token) return token;
    }
  } catch {
    return null;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStoredToken(ms: number): Promise<string | null> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const token = readStoredAccessToken();
    if (token) return token;
    await sleep(200);
  }
  return readStoredAccessToken();
}

function tryLockRefresh(): boolean {
  if (typeof localStorage === "undefined") return true;
  const now = Date.now();
  try {
    const raw = localStorage.getItem(REFRESH_LOCK);
    if (raw) {
      const lock = JSON.parse(raw) as { id?: string; until?: number };
      if (lock.id !== TAB_ID && typeof lock.until === "number" && lock.until > now) return false;
    }
    localStorage.setItem(REFRESH_LOCK, JSON.stringify({ id: TAB_ID, until: now + 8_000 }));
    return true;
  } catch {
    return true;
  }
}

function unlockRefresh() {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK);
    if (!raw) return;
    const lock = JSON.parse(raw) as { id?: string };
    if (lock.id === TAB_ID) localStorage.removeItem(REFRESH_LOCK);
  } catch {
    /* another tab can take the lock when it expires */
  }
}

async function readUserAccessToken(): Promise<string | null> {
  const stored = readStoredAccessToken();
  if (stored) return stored;
  if (!getAuthClient) return waitForStoredToken(2_000);

  if (!tryLockRefresh()) return waitForStoredToken(4_000);
  try {
    const { data } = await getAuthClient().auth.getSession();
    return usableToken(data.session?.access_token) ?? (await waitForStoredToken(2_000));
  } catch {
    return waitForStoredToken(2_000);
  } finally {
    unlockRefresh();
  }
}

function sessionExpiredResponse(): Response {
  return new Response(JSON.stringify({ message: "Session expired", code: "PGRST303" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

async function responseIsJwtError(response: Response): Promise<boolean> {
  if (response.status !== 401 && response.status !== 403) return false;
  try {
    const body = (await response.clone().json()) as { message?: string; code?: string; error?: string };
    const text = `${body.message ?? ""} ${body.code ?? ""} ${body.error ?? ""}`;
    return isJwtExpiredMessage(text);
  } catch {
    return false;
  }
}

export function createAuthAwareFetch(): typeof fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    if (isAuthRequest(url)) return rawFetch(input, init);

    let nextInit = init;
    const current = bearerFrom(init);
    const dataCall = isDataRequest(url);
    const userBearerMissing = !current || isAnonJwt(current) || tokenIsExpired(current);

    if (dataCall && userBearerMissing) {
      const fresh = await readUserAccessToken();
      if (fresh) nextInit = withBearer(init, fresh);
      else return sessionExpiredResponse();
    }

    const response = await rawFetch(input, nextInit);
    if (!dataCall || !(await responseIsJwtError(response))) return response;

    const fresh = await readUserAccessToken();
    const alreadySent = bearerFrom(nextInit);
    if (!fresh || fresh === alreadySent) return response;
    return rawFetch(input, withBearer(nextInit, fresh));
  };
}

function authClient() {
  return getAuthClient?.().auth ?? null;
}

/** Only the visible leader tab runs the refresh timer. */
function syncRefreshLeader() {
  const auth = authClient();
  if (!auth || typeof localStorage === "undefined") return;

  const now = Date.now();
  let leader: { id?: string; until?: number } | null = null;
  try {
    leader = JSON.parse(localStorage.getItem(LEADER_KEY) || "null") as { id?: string; until?: number } | null;
  } catch {
    leader = null;
  }

  const leaderMissing = !leader || leader.id === TAB_ID || typeof leader.until !== "number" || leader.until < now;
  const shouldLead = document.visibilityState === "visible" && leaderMissing;

  if (shouldLead) {
    try {
      localStorage.setItem(LEADER_KEY, JSON.stringify({ id: TAB_ID, until: now + 12_000 }));
    } catch {
      /* ignore quota */
    }
  }

  if (shouldLead && !leading) {
    leading = true;
    void auth.startAutoRefresh();
  } else if (!shouldLead && leading) {
    leading = false;
    void auth.stopAutoRefresh();
  }
}

export function installSessionKeepAlive() {
  if (typeof window === "undefined" || !getAuthClient || keepAliveInstalled) return;
  keepAliveInstalled = true;

  const wake = () => {
    syncRefreshLeader();
    if (document.visibilityState === "hidden") return;
    if (!readStoredAccessToken()) void readUserAccessToken();
  };

  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  window.setInterval(syncRefreshLeader, 4_000);
  syncRefreshLeader();
}
