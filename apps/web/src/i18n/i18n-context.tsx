import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  LanguageInfo,
  SupportedLanguage,
  TranslationKeys,
} from './types';
import { SUPPORTED_LANGUAGES } from './types';
import { en } from './translations/en';
import { es } from './translations/es';
import { tr } from './translations/tr';
import { ru } from './translations/ru';
import { id } from './translations/id';
import { vi } from './translations/vi';
import { hi } from './translations/hi';
import { fa } from './translations/fa';
import { uz } from './translations/uz';

const STORAGE_KEY = 'empire_language';

const VALID_CODES: Set<SupportedLanguage> = new Set([
  'en',
  'es',
  'tr',
  'ru',
  'id',
  'vi',
  'hi',
  'fa',
  'uz',
]);

const dictionaries: Record<SupportedLanguage, TranslationKeys> = {
  en,
  es,
  tr,
  ru,
  id,
  vi,
  hi,
  fa,
  uz,
};

function mapLanguageCode(rawCode?: string | null): SupportedLanguage | null {
  if (!rawCode) return null;
  const lower = rawCode.toLowerCase().trim();
  const short = lower.slice(0, 2);

  if (VALID_CODES.has(short as SupportedLanguage)) {
    return short as SupportedLanguage;
  }
  // Dialect / regional fallbacks
  if (short === 'uk' || short === 'be' || short === 'kk') return 'ru';
  if (short === 'az') return 'tr';
  if (short === 'in') return 'id'; // legacy ISO 639-1 code for Indonesian
  return null;
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && VALID_CODES.has(saved)) {
        return saved;
      }
    } catch {
      // Fallback
    }
  }

  // Detect from Telegram Mini App user info
  if (typeof window !== 'undefined') {
    const tgUserLang = (window.Telegram?.WebApp as unknown as {
      initDataUnsafe?: { user?: { language_code?: string } };
    })?.initDataUnsafe?.user?.language_code;

    const mappedTg = mapLanguageCode(tgUserLang);
    if (mappedTg) return mappedTg;

    // Detect from browser navigator
    const mappedNav = mapLanguageCode(navigator.language);
    if (mappedNav) return mappedNav;
  }

  // Default to English for global audience
  return 'en';
}

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: keyof TranslationKeys, fallback?: string) => string;
  supportedLanguages: LanguageInfo[];
  currentLanguageInfo: LanguageInfo;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(detectInitialLanguage);

  const setLanguage = (nextLang: SupportedLanguage) => {
    setLanguageState(nextLang);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, nextLang);
      } catch {
        // Ignore storage errors
      }
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = nextLang;
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const currentDict = dictionaries[language] ?? dictionaries.en;

  const t = useMemo(() => {
    return (key: keyof TranslationKeys, fallback?: string): string => {
      const val = currentDict[key];
      if (val !== undefined) return val;
      const enVal = dictionaries.en[key];
      if (enVal !== undefined) return enVal;
      return fallback ?? key;
    };
  }, [currentDict]);

  const currentLanguageInfo =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) ??
    SUPPORTED_LANGUAGES[0]!;

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageInfo,
    }),
    [language, t, currentLanguageInfo],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key, fallback) => en[key] ?? fallback ?? key,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageInfo: SUPPORTED_LANGUAGES[0]!,
    };
  }
  return context;
}
