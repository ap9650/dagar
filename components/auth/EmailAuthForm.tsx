"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Email + password — the D2 fallback for a learner with no Google account.
 *
 * Deliberately absent: any phone/OTP option. Indian SMS OTP requires DLT
 * registration, which we cannot get in a buildathon (D2). Do not add it "just in
 * case" — it will fail at the demo, not in development.
 */
export function EmailAuthForm() {
  const t = useTranslations();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Checked before the request so a short password is rejected inline, with no
  // round-trip and no page reload. The server validates it again — this is a
  // courtesy, not the check.
  const passwordTooShort = password.length > 0 && password.length < 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (passwordTooShort) return;

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(
          response.status === 429 ? t("errors.rateLimited") : t("login.failed"),
        );
        return;
      }

      if (body.needsConfirmation) {
        // Email confirmation is ON in Supabase: there is no session yet, so
        // pushing them to /learn would bounce straight back to /login.
        setNotice(t("login.checkEmail"));
        return;
      }

      // Server decides where they belong — a returning learner goes to /learn,
      // a new one to the grade screen. The client does not guess.
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-lg" noValidate>
      <Input
        label={t("login.emailLabel")}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Input
        label={t("login.passwordLabel")}
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={passwordTooShort ? t("login.passwordTooShort") : undefined}
      />

      {/* Amber, not red: a failed login is "not quite", not a system error. */}
      {error && (
        <p role="alert" className="text-body-sm text-notquite">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-body-sm text-hint">
          {notice}
        </p>
      )}

      <Button type="submit" loading={busy}>
        {mode === "signup" ? t("login.createAccount") : t("login.submit")}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setNotice(null);
        }}
        className="min-h-11 text-body-sm text-primary-strong underline underline-offset-2"
      >
        {mode === "login" ? t("login.createAccount") : t("login.haveAccount")}
      </button>
    </form>
  );
}
