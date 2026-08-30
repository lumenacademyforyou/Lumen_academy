import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import en from '../i18n/en.json';
import ta from '../i18n/ta.json';

type Language = 'en' | 'ta';

// BUG-16 (docs/assessment-tool-debug-plan.md): this is the app-wide UI
// language — chrome strings only (nav, buttons, labels, dialogs), always
// available everywhere. Never conflate with question-display mode (BUG-17):
// that's a separate, test/practice-only 'en'|'ta'|'bilingual' choice owned
// locally by TestTakingView, not this context — see its own
// questionLanguage state.
interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const UI_LANG_STORAGE_KEY = 'lumen_ui_lang';

function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
  return stored === 'ta' ? 'ta' : 'en';
}

function persistLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UI_LANG_STORAGE_KEY, lang);
  // A readable (non-HttpOnly) cookie, per the plan's own BUG-16 spec —
  // mirrors localStorage so a fresh load can apply the language before any
  // JS state has hydrated, and survives a cleared localStorage independent
  // of a cleared cookie jar (belt-and-braces, not redundant).
  document.cookie = `${UI_LANG_STORAGE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}

// BUG-16: chrome strings live in en.json/ta.json (this file used to hold a
// 440+ entry inline object literal here) — one resource file per language,
// not code, so translators/content staff can edit them without touching
// TypeScript. Keyed by the same English-string keys the app already calls
// t() with everywhere, so no call site needed to change.
const resources: Record<Language, Record<string, string>> = { en, ta };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'en' ? 'ta' : 'en'));
  };

  // Persist on every change (not just on toggle) so a caller using
  // setLanguage directly — e.g. Header.tsx's global toggle — persists too;
  // also applies <html lang> here, the one place BUG-16 asks for it, rather
  // than duplicating this effect at every call site.
  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return resources[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
