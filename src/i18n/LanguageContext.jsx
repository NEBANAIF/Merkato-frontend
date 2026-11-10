import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { startTranslator, stopTranslator } from './translator.js';

const LANG_KEY = 'erp.lang';
const LanguageContext = createContext({ lang: 'en', setLang: () => {}, toggle: () => {} });

function readInitial() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    return saved === 'am' ? 'am' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Holds the chosen language ('en' | 'am'), remembers it in localStorage, and
 * switches the DOM translator on/off. English is the default and is left
 * completely untouched - the translator only runs while Amharic is selected.
 */
export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const initial = readInitial();
    // Set before the first render so date formatting sees the right language.
    document.documentElement.lang = initial;
    return initial;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'am') startTranslator();
    else stopTranslator();
    return () => stopTranslator();
  }, [lang]);

  const setLang = useCallback((next) => {
    const value = next === 'am' ? 'am' : 'en';
    // Before the state change, so the re-render below already formats in the new language.
    document.documentElement.lang = value;
    try { localStorage.setItem(LANG_KEY, value); } catch { /* storage unavailable - still switch for this visit */ }
    setLangState(value);
  }, []);

  const toggle = useCallback(() => setLang(lang === 'am' ? 'en' : 'am'), [lang, setLang]);
  const value = useMemo(() => ({ lang, setLang, toggle }), [lang, setLang, toggle]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Re-mounts its children when the language changes, so things formatted in code
 * (dates) are redone. The session (AuthProvider) lives outside it and is kept; only
 * unsaved on-screen state, like a half-filled form, is reset.
 */
export function LanguageBoundary({ children }) {
  const { lang } = useLanguage();
  return <React.Fragment key={lang}>{children}</React.Fragment>;
}
