import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n, { resetI18nToBundled, type AppLanguage } from "../i18n";

export type Language = AppLanguage;

export interface TranslationItem {
  key: string;
  category: string;
  vi: string;
  en: string;
  isCustom?: boolean;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
  translationsList: TranslationItem[];
  updateTranslation: (key: string, vi: string, en: string, category?: string) => Promise<void>;
  createTranslation: (key: string, vi: string, en: string, category?: string) => Promise<void>;
  deleteTranslation: (key: string) => Promise<void>;
  saveAllToJSON: () => Promise<{ ok: boolean; message: string }>;
  publishToJSON: () => Promise<{ ok: boolean; message: string; data?: any }>;
  resetToDefaults: () => void;
  refreshTranslations: () => Promise<void>;
  loadLocaleTranslations: () => Promise<void>;
}

const fetchLocaleFile = async (lang: Language): Promise<Record<string, string>> => {
  try {
    const apiRes = await fetch(`/api/saas/locales/${lang}`);
    if (apiRes.ok) return (await apiRes.json()) as Record<string, string>;
  } catch { }

  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) return {};
    return (await res.json()) as Record<string, string>;
  } catch {
    return {};
  }
};

const buildTranslationItems = (enData: Record<string, any>, viData: Record<string, any>): TranslationItem[] => {
  const keys = new Set([...Object.keys(enData), ...Object.keys(viData)]);
  const items: TranslationItem[] = [];
  keys.forEach((key) => {
    if (key.startsWith('_')) return;
    const viVal = typeof viData[key] === 'string' ? viData[key] : '';
    const enVal = typeof enData[key] === 'string' ? enData[key] : '';
    items.push({
      key,
      category: 'common',
      vi: viVal || enVal || key,
      en: enVal || viVal || key,
    });
  });
  return items;
};

const loadFromI18nResources = (): TranslationItem[] => {
  const enData = (i18n.getResourceBundle('en', 'translation') as Record<string, string>) || {};
  const viData = (i18n.getResourceBundle('vi', 'translation') as Record<string, string>) || {};
  return buildTranslationItems(enData, viData);
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('app_language') as Language;
      return saved === 'en' ? 'en' : 'vi';
    } catch {
      return 'vi';
    }
  });

  // Built from in-memory i18n resources (already bundled). Do NOT parse a
  // 200KB localStorage dictionary on every webshop / login visit.
  const [translationsList, setTranslationsList] = useState<TranslationItem[]>(() => loadFromI18nResources());
  const [, setRevision] = useState(0);

  const loadLocaleTranslations = useCallback(async () => {
    const [enData, viData] = await Promise.all([
      fetchLocaleFile('en'),
      fetchLocaleFile('vi'),
    ]);
    if (Object.keys(enData).length > 0) {
      i18n.addResourceBundle('en', 'translation', enData, true, true);
    }
    if (Object.keys(viData).length > 0) {
      i18n.addResourceBundle('vi', 'translation', viData, true, true);
    }
    const items = buildTranslationItems(
      Object.keys(enData).length > 0 ? enData : ((i18n.getResourceBundle('en', 'translation') as Record<string, string>) || {}),
      Object.keys(viData).length > 0 ? viData : ((i18n.getResourceBundle('vi', 'translation') as Record<string, string>) || {}),
    );
    setTranslationsList(items);
    void i18n.changeLanguage(i18n.language);
  }, []);

  const refreshTranslations = useCallback(async () => {
    try {
      const res = await fetch(`/api/saas/translations/all`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          const viOverlay: Record<string, string> = {};
          const enOverlay: Record<string, string> = {};
          data.data.forEach((item: TranslationItem) => {
            if (item.key && !String(item.key).startsWith('_')) {
              if (item.vi) viOverlay[item.key] = item.vi;
              if (item.en) enOverlay[item.key] = item.en;
            }
          });
          if (Object.keys(viOverlay).length) i18n.addResourceBundle('vi', 'translation', viOverlay, true, true);
          if (Object.keys(enOverlay).length) i18n.addResourceBundle('en', 'translation', enOverlay, true, true);
          setTranslationsList(data.data);
          void i18n.changeLanguage(i18n.language);
          return;
        }
      }
    } catch (e) {
      // Fallback to locale files if offline/server error
    }
    await loadLocaleTranslations();
  }, [loadLocaleTranslations]);

  useEffect(() => {
    const bump = (lng?: string) => {
      if (lng === 'en' || lng === 'vi') {
        setLanguageState(lng);
      }
      setRevision((n) => n + 1);
      setTranslationsList(loadFromI18nResources());
    };
    i18n.on('languageChanged', bump);
    i18n.on('loaded', bump);
    return () => {
      i18n.off('languageChanged', bump);
      i18n.off('loaded', bump);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('app_language', language);
    } catch { }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      i18n.changeLanguage(lang).catch(() => {});
    } catch {}
  };

  const toggleLanguage = () => {
    const next: Language = language === 'vi' ? 'en' : 'vi';
    setLanguage(next);
  };

  const t = useCallback((key: string, defaultText?: string): string => {
    const value = i18n.t(key, { defaultValue: defaultText ?? '' });
    if (!value) return defaultText || key;
    return value;
  }, [language]);

  const persistI18nPair = (key: string, vi: string, en: string) => {
    i18n.addResourceBundle('vi', 'translation', { [key]: vi }, true, true);
    i18n.addResourceBundle('en', 'translation', { [key]: en }, true, true);
  };

  const updateTranslation = async (key: string, vi: string, en: string, category: string = 'common') => {
    const existingIndex = translationsList.findIndex((item) => item.key === key);
    let updated: TranslationItem[];

    if (existingIndex >= 0) {
      updated = [...translationsList];
      updated[existingIndex] = { ...updated[existingIndex], vi, en, category };
    } else {
      updated = [{ key, category, vi, en, isCustom: true }, ...translationsList];
    }

    setTranslationsList(updated);
    persistI18nPair(key, vi, en);

    try {
      await fetch('/api/saas/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, category, vi, en }),
      });
    } catch (e) {
      // Fallback saved locally
    }
  };

  const deleteTranslation = async (key: string) => {
    const updated = translationsList.filter((item) => item.key !== key);
    setTranslationsList(updated);

    try {
      await fetch(`/api/saas/translations/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      // Fallback deleted locally
    }
  };

  const createTranslation = async (key: string, vi: string, en: string, category: string = 'common') => {
    if (!key.trim()) return;

    const existingIndex = translationsList.findIndex((item) => item.key === key);
    let updated: TranslationItem[];

    if (existingIndex >= 0) {
      updated = [...translationsList];
      updated[existingIndex] = { ...updated[existingIndex], vi, en, category, isCustom: true };
    } else {
      updated = [{ key, category, vi, en, isCustom: true }, ...translationsList];
    }

    setTranslationsList(updated);
    persistI18nPair(key, vi, en);

    try {
      await fetch('/api/saas/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, category, vi, en }),
      });
    } catch (e) {
      // Fallback saved locally
    }
  };

  const saveAllToJSON = async (): Promise<{ ok: boolean; message: string }> => {
    const translations: Record<string, any> = {};
    translationsList.forEach((item) => {
      translations[item.key] = { vi: item.vi, en: item.en };
    });

    try {
      const res = await fetch('/api/saas/translations/json/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translations }),
      });
      const data = await res.json();
      return { ok: data.ok, message: data.message || 'Saved to JSON files.' };
    } catch (e: any) {
      return { ok: false, message: e.message || 'Failed to save to JSON files.' };
    }
  };

  const publishToJSON = async (): Promise<{ ok: boolean; message: string; data?: any }> => {
    try {
      const res = await fetch('/api/saas/translations/json/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      return { ok: data.ok, message: data.message || 'Published to JSON files.', data: data.data };
    } catch (e: any) {
      return { ok: false, message: e.message || 'Failed to publish to JSON files.' };
    }
  };

  const resetToDefaults = () => {
    resetI18nToBundled();
    setTranslationsList(loadFromI18nResources());
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        translationsList,
         updateTranslation,
        createTranslation,
        deleteTranslation,
        saveAllToJSON,
        publishToJSON,
        resetToDefaults,
        refreshTranslations,
        loadLocaleTranslations,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
