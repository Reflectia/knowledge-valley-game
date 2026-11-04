import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import uk from './locales/uk.json';

// v0.1 ships Ukrainian only; English is added in v0.3.
void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk } },
  lng: 'uk',
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

export default i18n;
