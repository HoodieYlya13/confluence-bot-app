import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

export class RateLimitError extends Error {
  constructor() {
    super("TOO_MANY_REQUESTS");
    this.name = "RateLimitError";
  }
}

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found. Rate limiting will be disabled.",
      );
      return null;
    }
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
    );
  }

  return new Redis({ url, token });
}

function getLimiter(identifier: string, redis: Redis) {
  switch (identifier) {
    case "search":
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        prefix: "rl:ip",
      });
    case "answer":
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(4, "1 m"),
        prefix: "rl:ip",
      });
    default:
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:ip",
      });
  }
}

function getGlobalBudget(identifier: string, redis: Redis) {
  if (identifier === "search")
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(500, "1 d"),
      prefix: "rl:budget",
    });
  if (identifier === "answer")
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(150, "1 d"),
      prefix: "rl:budget",
    });
  return null;
}

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  return (
    headerList.get("x-real-ip") ??
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function checkRateLimit(identifier: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const ip = await getClientIp();
  const limiter = getLimiter(identifier, redis);
  const { success } = await limiter.limit(`${identifier}-${ip}`);
  if (!success) throw new RateLimitError();

  const budget = getGlobalBudget(identifier, redis);
  if (budget) {
    const { success: withinBudget } = await budget.limit(identifier);
    if (!withinBudget) throw new RateLimitError();
  }
}
