import { NextResponse } from "next/server";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import { fetchHealth } from "@/lib/upstream";

export async function GET() {
  try {
    await checkRateLimit("default");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    throw error;
  }

  const health = await fetchHealth();
  if (!health) {
    return NextResponse.json({ online: false }, { status: 200 });
  }
  return NextResponse.json({ online: true, ...health });
}
