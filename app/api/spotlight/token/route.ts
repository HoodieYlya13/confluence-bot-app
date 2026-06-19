import { consumeCode, verifyPkce } from "@/lib/auth-codes";
import { checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import { isDemoRole, ROLE_LABELS, ROLE_TOKEN_ENV } from "@/lib/roles";
import { tryCatch } from "@/lib/utils";

export async function POST(request: Request) {
  const [limitErr] = await tryCatch(checkRateLimit("token"));
  if (limitErr instanceof RateLimitError)
    return Response.json({ error: "rate_limited" }, { status: 429 });
  if (limitErr) throw limitErr;

  const [parseErr, body] = await tryCatch(request.json());
  if (parseErr || typeof body !== "object" || body === null)
    return Response.json({ error: "invalid_request" }, { status: 400 });

  const { code, code_verifier } = body as {
    code?: unknown;
    code_verifier?: unknown;
  };
  if (typeof code !== "string" || typeof code_verifier !== "string")
    return Response.json({ error: "invalid_request" }, { status: 400 });

  const payload = await consumeCode(code);
  if (!payload)
    return Response.json({ error: "invalid_grant" }, { status: 400 });

  const verified = await verifyPkce(code_verifier, payload.codeChallenge);
  if (!verified || !isDemoRole(payload.role))
    return Response.json({ error: "invalid_grant" }, { status: 400 });

  const token = process.env[ROLE_TOKEN_ENV[payload.role]];
  if (!token) return Response.json({ error: "server_error" }, { status: 500 });

  return Response.json({
    access_token: token,
    role: payload.role,
    role_label: ROLE_LABELS[payload.role],
  });
}
