import "server-only";
import { Redis } from "@upstash/redis";

export const ALLOWED_REDIRECT_URI = "confluence-spotlight://auth";

export type CodePayload = {
  role: string;
  codeChallenge: string;
  state: string;
};

const CODE_TTL_SECONDS = 60;
const CODE_PREFIX = "spotlight:code:";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found. Spotlight auth codes will use an in-memory dev store.",
      );
      return null;
    }
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
    );
  }

  return new Redis({ url, token });
}

const devStore = new Map<string, { payload: CodePayload; expiresAt: number }>();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function mintCode(payload: CodePayload): Promise<string> {
  const code = randomToken();
  const redis = getRedis();

  if (redis)
    await redis.set(CODE_PREFIX + code, payload, { ex: CODE_TTL_SECONDS });
  else
    devStore.set(code, {
      payload,
      expiresAt: Date.now() + CODE_TTL_SECONDS * 1000,
    });

  return code;
}

export async function consumeCode(code: string): Promise<CodePayload | null> {
  const redis = getRedis();

  if (redis) return redis.getdel<CodePayload>(CODE_PREFIX + code);

  const entry = devStore.get(code);
  devStore.delete(code);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.payload;
}

export async function verifyPkce(
  verifier: string,
  challenge: string,
): Promise<boolean> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const computed = base64url(new Uint8Array(digest));

  if (computed.length !== challenge.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++)
    mismatch |= computed.charCodeAt(i) ^ challenge.charCodeAt(i);
  return mismatch === 0;
}
