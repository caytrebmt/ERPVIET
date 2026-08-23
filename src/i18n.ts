import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import viLocale from "../public/locales/vi.json";
import enLocale from "../public/locales/en.json";

export type AppLanguage = "vi" | "en";

/** Flatten locale JSON: keep string values, drop metadata keys such as `_groups`. */
export const toFlatStrings = (data: Record<string, unknown> | null | undefined): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (!key || key.startsWith("_")) continue;
    if (typeof value === "string") out[key] = value;
  }
  return out;
};

const bundledVi = toFlatStrings(viLocale as Record<string, unknown>);
const bundledEn = toFlatStrings(enLocale as Record<string, unknown>);

export const getBundledTranslations = (): { vi: Record<string, string>; en: Record<string, string> } => ({
  vi: bundledVi,
  en: bundledEn,
});

export const getStoredLanguage = (): AppLanguage => {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return "vi";
  }
  try {
    const saved = localStorage.getItem("app_language");
    return saved === "en" ? "en" : "vi";
  } catch {
    return "vi";
  }
};

const applyDocumentLang = (lng: string) => {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lng === "en" ? "en" : "vi";
};

const initialLanguage = getStoredLanguage();
applyDocumentLang(initialLanguage);

// Bundle both locale files so the first paint already has real copy.
// `initImmediate: false` makes init synchronous — `t()` never returns raw keys
// while a network request is in flight.
i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: bundledVi },
    en: { translation: bundledEn },
  },
  lng: initialLanguage,
  fallbackLng: "vi",
  debug: false,
  initAsync: false,
  // Locale files are flat maps (`"nav_login": "Đăng nhập"`). Do not treat
  // `.` / `:` inside a key as nested-object or namespace separators.
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  returnNull: false,
  returnEmptyString: false,
  parseMissingKeyHandler: (key, defaultValue) =>
    typeof defaultValue === "string" && defaultValue.length > 0 ? defaultValue : key,
});

const OVERLAY_CACHE_KEY = "i18n_overlay_cache_v1";
const OVERLAY_TTL_MS = 5 * 60 * 1000;

type OverlayCache = {
  ts: number;
  data: Partial<Record<AppLanguage, Record<string, string>>>;
};

const readOverlayCache = (): Partial<Record<AppLanguage, Record<string, string>>> => {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(OVERLAY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OverlayCache;
    if (!parsed || Date.now() - Number(parsed.ts || 0) > OVERLAY_TTL_MS) return {};
    return parsed.data || {};
  } catch {
    return {};
  }
};

const writeOverlayCache = (data: Partial<Record<AppLanguage, Record<string, string>>>) => {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload: OverlayCache = { ts: Date.now(), data };
    sessionStorage.setItem(OVERLAY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
};

const fetchPublishedLocale = async (lng: AppLanguage): Promise<Record<string, string> | null> => {
  try {
    const res = await fetch(`/api/saas/locales/${lng}`);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    const flat = toFlatStrings(json);
    return Object.keys(flat).length > 0 ? flat : null;
  } catch {
    return null;
  }
};

/** Merge a published-on-disk locale overlay into the already-bundled resources. */
export const mergeLocaleOverlay = (lng: AppLanguage, overlay: Record<string, string>) => {
  if (!overlay || Object.keys(overlay).length === 0) return;
  i18n.addResourceBundle(lng, "translation", overlay, true, true);
};

/**
 * After first paint, overlay any JSON that an admin published to disk.
 * Never blocks the first render — bundled copy is already on screen.
 */
export const applyLocaleOverlay = async (languages: AppLanguage[] = ["vi", "en"]) => {
  const cached = readOverlayCache();
  const nextCache: Partial<Record<AppLanguage, Record<string, string>>> = { ...cached };
  let changed = false;

  await Promise.all(
    languages.map(async (lng) => {
      let overlay = cached[lng];
      if (!overlay) {
        overlay = (await fetchPublishedLocale(lng)) || undefined;
      }
      if (!overlay || Object.keys(overlay).length === 0) return;
      nextCache[lng] = overlay;
      mergeLocaleOverlay(lng, overlay);
      changed = true;
    }),
  );

  writeOverlayCache(nextCache);
  if (changed) {
    void i18n.changeLanguage(i18n.language);
  }
};

export const resetI18nToBundled = () => {
  i18n.addResourceBundle("vi", "translation", bundledVi, true, true);
  i18n.addResourceBundle("en", "translation", bundledEn, true, true);
  void i18n.changeLanguage(i18n.language);
};

// Apply a session-cached overlay synchronously (no network) so a second visit
// in the same tab already has published updates before paint.
const cachedOverlay = readOverlayCache();
if (cachedOverlay.vi) mergeLocaleOverlay("vi", cachedOverlay.vi);
if (cachedOverlay.en) mergeLocaleOverlay("en", cachedOverlay.en);

if (typeof window !== "undefined") {
  const schedule = (cb: () => void) => {
    window.setTimeout(cb, 1);
  };
  schedule(() => {
    void applyLocaleOverlay(["vi", "en"]);
  });
}

i18n.on("languageChanged", applyDocumentLang);

export default i18n;
