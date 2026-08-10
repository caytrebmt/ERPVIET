import i18n from "i18next";
import { initReactI18next } from "react-i18next";

export type AppLanguage = "vi" | "en";

const fetchLocale = async (lng: AppLanguage): Promise<Record<string, string>> => {
  try {
    const apiRes = await fetch(`/api/saas/locales/${lng}`, { cache: "no-store" });
    if (apiRes.ok) return ((await apiRes.json()) as Record<string, string>);
  } catch { }

  try {
    const res = await fetch(`/locales/${lng}.json`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Record<string, string>) : {};
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

// NOTE: do NOT use top-level `await` here. Vite's browser build targets es2020,
// which does not allow top-level await and the Netlify build would fail.
// Instead we initialise synchronously (empty resources) and merge the JSON
// locale files asynchronously, then notify react-i18next subscribers to
// re-render. The fetch targets tiny local files, so the first paint that still
// shows the raw key resolves within a few milliseconds.
i18n.use(initReactI18next).init({
  resources: { en: { translation: {} }, vi: { translation: {} } },
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

Promise.all([fetchLocale("en"), fetchLocale("vi")]).then(([enRes, viRes]) => {
  i18n.addResourceBundle("en", "translation", enRes, true, false);
  i18n.addResourceBundle("vi", "translation", viRes, true, false);
  void i18n.changeLanguage(i18n.language);
});

export default i18n;
