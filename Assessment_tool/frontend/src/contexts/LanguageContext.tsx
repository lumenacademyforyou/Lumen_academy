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

// LA-UX-REFRESH-001 F1: the app no longer exposes a chrome-language switch
// anywhere (Tamil is a question-display choice inside the test console only),
// so chrome is always English. This deliberately IGNORES a previously stored
// 'ta' rather than honouring it — without a toggle in the UI, an account that
// had switched to Tamil before this change would otherwise be stranded there
// with no way back. setLanguage/toggleLanguage below are kept so the context
// contract and its ~450 t() call sites are untouched; nothing calls them now.
function readStoredLanguage(): Language {
  return 'en';
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
