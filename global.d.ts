import type { Locale } from "@/i18n/config";
import type messages from "./messages/en.json";

/**
 * Types the whole i18n layer off the English dictionary.
 *
 * The payoff: `t("dashbord.greeting")` is a TypeScript error, not a string that
 * silently renders as its own key on the demo. English is the source of truth,
 * so a key that exists in `hi.json` but not `en.json` is dead weight and a key
 * missing from `hi.json` falls back to English at runtime.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
