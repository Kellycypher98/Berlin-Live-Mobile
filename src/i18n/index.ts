// Tiny translation layer (same as the web app). Texts are written in English in the code; other
// languages map the English text to their own (see de.ts). Missing ones fall back to English.
//   t("Leave now")                  -> "Jetzt los"
//   t("in {n} min", { n: 5 })       -> "in 5 Min."
import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { de } from "./de";

export type Lang = "en" | "de";
export const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "de", label: "Deutsch" },
];
const DICTS: Record<Lang, Record<string, string> | null> = { en: null, de };
const STORE_KEY = "blt-lang";

let lang: Lang = (() => {
  try { return getLocales().some(l => l.languageCode === "de") ? "de" : "en"; } catch { return "en"; }
})();
const listeners = new Set<() => void>();
const missing = new Set<string>();

// A language picked in the app wins over the phone's language
AsyncStorage.getItem(STORE_KEY).then(v => { if (v === "en" || v === "de") setLang(v, false); }).catch(() => {});

export function t(text: string, vars?: Record<string, string | number>): string {
  let out = text;
  const dict = DICTS[lang];
  if (dict) {
    if (dict[text] !== undefined) out = dict[text];
    else if (__DEV__ && !missing.has(text)) { missing.add(text); console.log(`[i18n] no ${lang} text for: ${text}`); }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

export const getLang = () => lang;
export const locale = () => (lang === "de" ? "de-DE" : "en-GB");

export function setLang(next: Lang, save = true) {
  if (next === lang) return;
  lang = next;
  if (save) AsyncStorage.setItem(STORE_KEY, next).catch(() => {});
  listeners.forEach(f => f());
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

/** Re-renders the component when the language changes. */
export function useLang() {
  const current = useSyncExternalStore(subscribe, getLang);
  return { lang: current, t, setLang };
}
