import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import i18n from "../i18n";

export type Language = 'vi' | 'en';

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
    const apiRes = await fetch(`/api/saas/locales/${lang}`, { cache: "no-store" });
    if (apiRes.ok) return (await apiRes.json()) as Record<string, string>;
  } catch { }

  try {
    const res = await fetch(`/locales/${lang}.json`, { cache: "no-store" });
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
  const res = (i18n as any).resources;
  const enData = (res?.en?.translation as Record<string, string>) || {};
  const viData = (res?.vi?.translation as Record<string, string>) || {};
  if (Object.keys(enData).length === 0 && Object.keys(viData).length === 0) return [];
  return buildTranslationItems(enData, viData);
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language') as Language;
    return saved === 'en' ? 'en' : 'vi';
  });

  const [translationsList, setTranslationsList] = useState<TranslationItem[]>(() => {
    const saved = localStorage.getItem('saas_translation_dictionary');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Error parsing stored translations', e);
      }
    }
    return loadFromI18nResources();
  });

  const loadLocaleTranslations = useCallback(async () => {
    const [enData, viData] = await Promise.all([
      fetchLocaleFile('en'),
      fetchLocaleFile('vi'),
    ]);
    const items = buildTranslationItems(enData, viData);
    setTranslationsList(items);
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(items));
  }, []);

  const refreshTranslations = useCallback(async () => {
    try {
      const res = await fetch(`/api/saas/translations/all`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          setTranslationsList(data.data);
          localStorage.setItem('saas_translation_dictionary', JSON.stringify(data.data));
          localStorage.setItem('saas_translation_dictionary_updated_at', String(Date.now()));
          return;
        }
      }
    } catch (e) {
      // Fallback to locale files if offline/server error
    }
    await loadLocaleTranslations();
  }, [loadLocaleTranslations]);

  useEffect(() => {
    const saved = localStorage.getItem('saas_translation_dictionary');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return;
        }
      } catch (e) {
        console.error('Error parsing stored translations', e);
      }
    }
    loadLocaleTranslations();
  }, [loadLocaleTranslations]);

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/saas')) return;

    const refreshedAt = Number(localStorage.getItem('saas_translation_dictionary_updated_at') || 0);
    if (Date.now() - refreshedAt < 60 * 60 * 1000) return;
    refreshTranslations();
  }, [refreshTranslations]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      i18n.changeLanguage(lang).catch(() => {});
    } catch {}
  };

  const toggleLanguage = () => {
    const next: Language = language === 'vi' ? 'en' : 'vi';
    setLanguageState(next);
    try {
      i18n.changeLanguage(next).catch(() => {});
    } catch {}
  };

  const t = (key: string, defaultText?: string): string => {
    return i18n.t(key, { defaultValue: defaultText });
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
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(updated));

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
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(updated));

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
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(updated));

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
    localStorage.removeItem('saas_translation_dictionary');
    loadLocaleTranslations();
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