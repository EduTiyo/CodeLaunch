import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "./locales/en-us.json";
import ptBR from "./locales/pt-br.json";

export const SUPPORTED_LANGUAGES = ["en-us", "pt-br"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en-us";
const STORAGE_KEY = "codelaunch_language";

export const resources = {
  "en-us": { translation: enUS },
  "en-US": { translation: enUS },
  "pt-br": { translation: ptBR },
  "pt-BR": { translation: ptBR },
} as const;

export function getInitialLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(STORAGE_KEY)?.toLowerCase();
  if (stored === "pt-br" || stored === "pt") {
    return "pt-br";
  }
  return DEFAULT_LANGUAGE;
}

const initialLang = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLang;
}

export function setAppLanguage(lang: SupportedLanguage) {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export default i18n;
