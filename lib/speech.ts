"use client";

/**
 * Reading a lesson aloud.
 *
 * ── THE POINT, AND WHOSE IDEA IT WAS ────────────────────────────────────────
 * A teacher of Classes 6–8 said it, and nobody would have predicted it: **the
 * spoken language is chosen separately from the written one.** A learner reading
 * the English lesson may want it explained in Hindi. The two are different
 * abilities and the app had been treating them as one setting.
 *
 * So this store keeps its own language, independent of `profiles.locale`.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `speechSynthesis` costs nothing: no files, no bytes, no API. It also does not
 * send the learner anywhere — we hand the browser OUR text. (The privacy
 * question belongs to speech *recognition*, which is a different feature.)
 *
 * Absent, never broken: a device with no Hindi voice is not offered Hindi.
 */

import type { Locale } from "@/i18n/config";

const LANG_KEY = "saathi.speech.lang";

/** BCP-47 tags, Indian variants first — closest accent for these learners. */
const VOICE_TAGS: Record<Locale, string[]> = {
  en: ["en-IN", "en-GB", "en-US", "en"],
  hi: ["hi-IN", "hi"],
};

export type SpeechState = {
  /** Languages this device can actually speak, in `Locale` terms. */
  available: Locale[];
  /** The chosen one. Never a language with no voice. */
  lang: Locale;
  speaking: boolean;
};

const SERVER_STATE: SpeechState = { available: [], lang: "en", speaking: false };

let state: SpeechState = SERVER_STATE;
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  for (const listener of listeners) listener();
}

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

function pickVoice(lang: Locale): SpeechSynthesisVoice | null {
  const engine = synth();
  if (!engine) return null;
  const voices = engine.getVoices();
  for (const tag of VOICE_TAGS[lang]) {
    const exact = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
  }
  const prefix = lang === "hi" ? "hi" : "en";
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null;
}

function read(): SpeechState {
  const available = (["en", "hi"] as Locale[]).filter((lang) => pickVoice(lang));
  const stored = localStorage.getItem(LANG_KEY) as Locale | null;
  const lang = stored && available.includes(stored) ? stored : (available[0] ?? "en");
  return { available, lang, speaking: synth()?.speaking ?? false };
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getSnapshot = () => state;
export const getServerSnapshot = () => SERVER_STATE;

/**
 * Re-read the device's capabilities.
 *
 * Called on mount AND on `voiceschanged`: Chrome returns an EMPTY voice list on
 * first call and fills it asynchronously, so a one-shot check at mount decides
 * the device has no voices at all and hides the button forever.
 */
export function refresh() {
  if (typeof window === "undefined") return;
  const next = read();
  if (
    next.lang === state.lang &&
    next.speaking === state.speaking &&
    next.available.join() === state.available.join()
  ) {
    return;
  }
  state = next;
  emit();
}

let wired = false;

export function watchVoices() {
  const engine = synth();
  if (!engine || wired) return;
  wired = true;
  engine.addEventListener("voiceschanged", refresh);
}

export function setLang(lang: Locale) {
  localStorage.setItem(LANG_KEY, lang);
  state = { ...state, lang };
  emit();
}

export function stop() {
  synth()?.cancel();
  state = { ...state, speaking: false };
  emit();
}

/** Speak, replacing anything already being said. */
export function speak(text: string, lang: Locale) {
  const engine = synth();
  if (!engine || !text.trim()) return;

  // Always cancel first. Queueing means a learner who taps twice hears the step
  // twice, back to back, with no way to stop it.
  engine.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? (lang === "hi" ? "hi-IN" : "en-IN");
  // Slower than default. These are second-language readers meeting new
  // vocabulary, and the default rate is tuned for fluent adults.
  utterance.rate = 0.9;

  utterance.onend = () => {
    state = { ...state, speaking: false };
    emit();
  };
  utterance.onerror = () => {
    state = { ...state, speaking: false };
    emit();
  };

  state = { ...state, speaking: true };
  emit();
  engine.speak(utterance);
}
