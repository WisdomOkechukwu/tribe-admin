"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { login, type LoginState } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Work email" name="email" type="email" autoComplete="username" defaultValue={state.email} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" />
      {state.error && (
        <p role="alert" className="rounded-chip bg-error-50 px-3 py-2 text-[12.5px] text-error-600 dark:bg-error-600/15 dark:text-error-50">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function Field({ label, ...input }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider">{label}</span>
      <input
        required
        {...input}
        className="h-12 w-full rounded-chip border-2 border-edge bg-surface px-4 text-[14px] outline-none placeholder:text-muted focus:border-purple-500 focus:shadow-hard-sm focus-visible:outline-none"
      />
    </label>
  );
}
