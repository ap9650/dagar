#!/usr/bin/env bash
#
# Push the env vars from .env.local into Vercel Production.
#
# Run AFTER `vercel login` and `vercel link`, BEFORE the first `vercel --prod`.
#
#   bash scripts/vercel-env.sh
#
# Values are piped straight from .env.local into `vercel env add` on stdin, so no
# secret is ever echoed to the terminal, into your shell history, or into a chat
# transcript. Re-running is safe: each key is removed and re-added.
#
# Deliberately does NOT push:
#   TWILIO_*             — empty until Day 3 (WhatsApp)
#   NEXT_PUBLIC_SITE_URL — chicken-and-egg. You do not know the production URL
#                          until the first deploy has run. Set it afterwards with:
#                            vercel env add NEXT_PUBLIC_SITE_URL production
#                          then redeploy, because NEXT_PUBLIC_ values are baked in
#                          at build time.

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.local"
TARGET="production"

KEYS=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ANTHROPIC_API_KEY
  CRON_SECRET
)

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ $ENV_FILE not found. Run this from the project root."
  exit 1
fi

if [ ! -d ".vercel" ]; then
  echo "✗ No .vercel directory — the project is not linked yet."
  echo "  Run: vercel link"
  exit 1
fi

# Reads one key's value, stripping an inline '# comment' and surrounding quotes
# or whitespace. Never prints the value.
read_value() {
  grep -E "^$1=" "$ENV_FILE" \
    | head -1 \
    | sed -E "s/^$1=//; s/[[:space:]]+#.*$//; s/^[\"']//; s/[\"']$//" \
    | xargs 2>/dev/null || true
}

for key in "${KEYS[@]}"; do
  value="$(read_value "$key")"

  if [ -z "$value" ]; then
    echo "⊘ $key is empty in $ENV_FILE — skipped"
    continue
  fi

  # Ignore the failure when the variable does not exist yet.
  vercel env rm "$key" "$TARGET" --yes >/dev/null 2>&1 || true
  printf '%s' "$value" | vercel env add "$key" "$TARGET" >/dev/null
  echo "✓ $key  (${#value} chars)"
done

echo
echo "Done. Now deploy:  vercel --prod"
