import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type AppLanguage = "vi" | "en";

const fetchLocale = async (lng: AppLanguage): Promise<Record<string, string>> => {
  try {
    const res = await fetch(`/locales/${lng}.json`, { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, string>;
  } catch {
    return {};
  }
};

export const getStoredLanguage = (): AppLanguage => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "vi";
  }
  const saved = localStorage.getItem("app_language");
  return saved === "en" ? "en" : "vi";
};

const initialLanguage = getStoredLanguage();
const enResources = await fetchLocale("en");
const viResources = await fetchLocale("vi");

await i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enResources },
    vi: { translation: viResources },
  },
  lng: initialLanguage,
  fallbackLng: "vi",
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
