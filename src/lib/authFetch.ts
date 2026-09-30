/**
 * Access tokens expire about an hour after sign-in. A backgrounded tab
 * stops the SDK refresh timer, so the next save or reload can go out with a
 * dead JWT. PostgREST then returns "JWT expired", or — if the client falls
 * back to the anon key — row-level security returns zero rows and posted
 * application links look deleted.
 *
 * This fetch does not call refreshSession(). That forces a second refresh
 * token rotation on top of the SDK's own refresh, and the loser of that
 * race clears the session for every open tab. getSession() joins the SDK's
 * single in-flight refresh instead.
 */

type GetAuthClient = () => {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string; expires_at?: number } | null };
    }>;
  };
};

const rawFetch = globalThis.fetch.bind(globalThis);
const SESSION_EXPIRED = "jobpilot:session-expired";

let getAuthClient: GetAuthClient | null = null;
let sessionRead: Promise<string | null> | null = null;
let sessionExpiredNotified = false;
let keepAliveInstalled = false;

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

/** True when the access token is already expired or will be within 30 seconds. */
function tokenIsExpired(token: string): boolean {
  const exp = jwtPayload(token)?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 <= Date.now() + 30_000;
}

function sessionExpiredResponse(): Response {
  return new Response(
    JSON.stringify({
      message: "Session expired",
      code: "PGRST303",
    }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function notifySessionExpired() {
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED));
  }
}

export const SESSION_EXPIRED_EVENT = SESSION_EXPIRED;

/** Join the SDK refresh. Never starts a second refreshSession() rotation. */
function readUserAccessToken(): Promise<string | null> {
  if (!getAuthClient) return Promise.resolve(null);
  if (!sessionRead) {
    sessionRead = getAuthClient()
      .auth.getSession()
      .then(({ data }) => {
        const token = data.session?.access_token ?? null;
        if (!token || isAnonJwt(token) || tokenIsExpired(token)) return null;
        return token;
      })
      .catch(() => null)
      .finally(() => {
        sessionRead = null;
      });
  }
  return sessionRead;
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
      else {
        // Never send the anon key: that query succeeds with zero rows.
        if (current && !isAnonJwt(current)) notifySessionExpired();
        return sessionExpiredResponse();
      }
    }

    const response = await rawFetch(input, nextInit);
    if (!dataCall || !(await responseIsJwtError(response))) return response;

    const fresh = await readUserAccessToken();
    const alreadySent = bearerFrom(nextInit);
    if (!fresh || fresh === alreadySent) {
      notifySessionExpired();
      return sessionExpiredResponse();
    }
    const retried = await rawFetch(input, withBearer(nextInit, fresh));
    if (await responseIsJwtError(retried)) {
      notifySessionExpired();
      return sessionExpiredResponse();
    }
    return retried;
  };
}

/** Ask the SDK to recover a session when the employee comes back to a tab. */
export function installSessionKeepAlive() {
  if (typeof window === "undefined" || !getAuthClient || keepAliveInstalled) return;
  keepAliveInstalled = true;

  const wake = () => {
    if (document.visibilityState === "hidden") return;
    void readUserAccessToken();
  };

  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  window.setInterval(wake, 60_000);
}
