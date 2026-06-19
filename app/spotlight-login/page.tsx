import { use } from "react";
import { PendingButton } from "@/components/pending-button";
import { isAllowedRedirectUri } from "@/lib/auth-codes";
import { DEMO_ROLES, ROLE_LABELS, ROLE_TOKEN_ENV } from "@/lib/roles";
import { authorizeRole } from "./actions";

export const metadata = {
  title: "Sign in — Confluence Spotlight",
};

type SpotlightLoginSearchParams = Promise<{
  state?: string;
  code_challenge?: string;
  redirect_uri?: string;
}>;

export default function SpotlightLoginPage({
  searchParams,
}: {
  searchParams: SpotlightLoginSearchParams;
}) {
  const { state, code_challenge, redirect_uri } = use(searchParams);

  const valid =
    typeof state === "string" &&
    state.length > 0 &&
    typeof code_challenge === "string" &&
    code_challenge.length > 0 &&
    typeof redirect_uri === "string" &&
    isAllowedRedirectUri(redirect_uri);

  if (!valid)
    return (
      <div className="mx-auto max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
        <h1 className="text-lg font-semibold">Invalid sign-in request</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          This page is the Confluence Spotlight sign-in handoff. Open it from
          the desktop app&rsquo;s <strong>Connect</strong> button rather than
          directly.
        </p>
      </div>
    );

  const availableRoles = DEMO_ROLES.filter((role) =>
    Boolean(process.env[ROLE_TOKEN_ENV[role]]),
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8">
      <div className="flex flex-col gap-2 text-center">
        <span className="mx-auto text-xs font-mono uppercase tracking-widest text-sky-600 dark:text-sky-400">
          CERN SSO · demo
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          Sign in to Confluence Spotlight
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Choose a demo persona. The desktop app receives a one-time
          authorization code for that role — never the bearer token itself.
        </p>
      </div>

      {availableRoles.length === 0 ? (
        <p className="text-center text-sm text-amber-600 dark:text-amber-400">
          No roles are configured on this server.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {availableRoles.map((role) => (
            <form key={role} action={authorizeRole}>
              <input type="hidden" name="role" value={role} />
              <input type="hidden" name="state" value={state} />
              <input
                type="hidden"
                name="code_challenge"
                value={code_challenge}
              />
              <input type="hidden" name="redirect_uri" value={redirect_uri} />
              <PendingButton
                pendingLabel="Returning to the app…"
                className="flex w-full items-center justify-between rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-left text-sm font-medium hover:border-sky-500 dark:hover:border-sky-500 disabled:opacity-50 cursor-pointer"
              >
                <span>{ROLE_LABELS[role]}</span>
                <span className="font-mono text-xs text-zinc-500">{role}</span>
              </PendingButton>
            </form>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-zinc-500">
        Continue as the selected persona — your browser will hand off to the
        Confluence Spotlight app.
      </p>
    </div>
  );
}
