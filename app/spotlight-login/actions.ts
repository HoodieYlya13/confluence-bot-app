"use server";

import { redirect } from "next/navigation";
import { ALLOWED_REDIRECT_URI, mintCode } from "@/lib/auth-codes";
import { checkRateLimit } from "@/lib/ratelimit";
import { isDemoRole, ROLE_TOKEN_ENV } from "@/lib/roles";

export async function authorizeRole(formData: FormData) {
  const role = String(formData.get("role") ?? "");
  const state = String(formData.get("state") ?? "");
  const codeChallenge = String(formData.get("code_challenge") ?? "");
  const redirectUri = String(formData.get("redirect_uri") ?? "");

  if (redirectUri !== ALLOWED_REDIRECT_URI)
    throw new Error("Invalid redirect_uri.");
  if (!isDemoRole(role)) throw new Error("Unknown role.");
  if (!state || !codeChallenge)
    throw new Error("Missing authorization parameters.");
  if (!process.env[ROLE_TOKEN_ENV[role]])
    throw new Error("Role is not available.");

  await checkRateLimit("authorize");
  const code = await mintCode({ role, codeChallenge, state });

  redirect(
    `${redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
  );
}
