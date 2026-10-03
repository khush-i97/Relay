import { ApiProblem } from "./errors";
import { serverDb } from "./supabase";

export const SESSION_COOKIE = "bitequest_session";

export interface ServerSession {
  sessionId: string;
  userId: string;
  expiresAt: string;
}

export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

export async function requireSession(request: Request): Promise<ServerSession> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) throw new ApiProblem("UNAUTHENTICATED", "A demo session is required");
  const { data, error } = await serverDb().rpc("resolve_demo_session", { p_token_hash: await hashSessionToken(token) });
  const session = Array.isArray(data) ? data[0] : null;
  if (error || !session) throw new ApiProblem("UNAUTHENTICATED", "Demo session is missing or expired");
  return { sessionId: session.session_id, userId: session.user_id, expiresAt: session.expires_at };
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

function readCookie(header: string | null, name: string): string | undefined {
  return header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}
