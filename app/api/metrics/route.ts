import { NextResponse } from "next/server";
import { parsePrometheus } from "@/lib/prometheus";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import { fetchMetricsText } from "@/lib/upstream";

export async function GET() {
  try {
    await checkRateLimit("default");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    throw error;
  }

  const text = await fetchMetricsText();
  if (text === null) {
    return NextResponse.json({ online: false, samples: [] }, { status: 200 });
  }
  return NextResponse.json({ online: true, samples: parsePrometheus(text) });
}
