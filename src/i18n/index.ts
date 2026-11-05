import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { Localized } from '@/core/content';

import uk from './locales/uk.json';

// v0.1 ships Ukrainian only; English is added in v0.3.
void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk } },
  lng: 'uk',
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

// Screen readers pick the voice from <html lang> (WCAG 3.1.1).
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

/** A content string (names from theme packs) in the current UI language, falling back to Ukrainian. */
export function loc(v: Localized): string;
export function loc(v: Localized | undefined): string | undefined;
export function loc(v: Localized | undefined): string | undefined {
  if (!v) return undefined;
  return (i18n.language === 'en' ? v.en : undefined) ?? v.uk;
}

export default i18n;
