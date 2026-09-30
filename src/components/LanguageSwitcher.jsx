import React from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/**
 * EN | አማ pill. translate="no" keeps the translator away from its own labels,
 * so each option always shows its own language's name.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useLanguage();
  const options = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'am', label: 'አማ', full: 'አማርኛ' },
  ];
  return (
    <div
      translate="no"
      role="group"
      aria-label="Language / ቋንቋ"
      className={`inline-flex items-center rounded-full border p-0.5 ${className}`}
      style={{ borderColor: 'rgba(140,128,70,0.35)', background: 'rgba(250,249,240,0.8)' }}
    >
      {options.map((o) => {
        const active = lang === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => setLang(o.code)}
            aria-pressed={active}
            title={o.full}
            className="rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
            style={{
              background: active ? '#7a7d55' : 'transparent',
              color: active ? '#faf9f0' : '#6e674e',
              fontFamily: "'Noto Sans Ethiopic','Inter',sans-serif",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
