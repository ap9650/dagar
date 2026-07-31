"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LINK_CODE_LENGTH, normaliseLinkCode } from "@/lib/parent/linkCode";

/**
 * The code entry. Six characters, and the whole screen is this one field.
 *
 * The input normalises as you type — uppercase, spaces dropped — so a parent who
 * types lowercase or adds a space is not told they got it wrong. What it does
 * NOT do is guess at ambiguous characters; see `normaliseLinkCode` for why
 * folding `0`→`O` is a bad idea rather than a kindness.
 *
 * `autoComplete="off"` and `autoCapitalize="characters"`: on a shared Android
 * phone an autofill dropdown over this field can offer whatever the last person
 * typed, and the code is not a word the keyboard should be helping with.
 */
export function ClaimCodeForm() {
  const t = useTranslations();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = code.length === LINK_CODE_LENGTH;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/parent-links/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link_code: code }),
      });
      const body = await response.json();

      if (!response.ok) {
        // Each failure gets the message whose RECOVERY is different: re-check the
        // code, ask for a new one, wait, or you are in the wrong place. A single
        // "invalid" for all four leaves a parent with nothing to do next.
        setError(
          body.code === "EXPIRED_CODE"
            ? t("parent.claimExpired")
            : body.code === "ALREADY_A_LEARNER"
              ? t("parent.claimIsLearner")
              : body.code === "SELF_CLAIM"
                ? t("parent.claimSelf")
                : response.status === 429
                  ? t("errors.rateLimited")
                  : t("parent.claimInvalid"),
        );
        return;
      }

      // Full reload rather than a client push: the claim just created a profile
      // and a link, and the parent view is a Server Component that has to be
      // rendered with them in place.
      router.replace("/parent");
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
        label={t("parent.claimCodeLabel")}
        value={code}
        onChange={(event) => {
          setCode(normaliseLinkCode(event.target.value));
          setError(null);
        }}
        maxLength={LINK_CODE_LENGTH}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        className="text-center font-mono text-h2 tracking-[0.3em] uppercase"
      />

      {/* Amber, not red: a mistyped code is "not quite", not a system failure. */}
      {error && (
        <p role="alert" className="text-body-sm text-notquite">
          {error}
        </p>
      )}

      <Button type="submit" loading={busy} disabled={!ready}>
        {t("parent.claimSubmit")}
      </Button>
    </form>
  );
}
