import { describe, it, expect } from 'vitest';
import { en } from './translations/en';
import { tr } from './translations/tr';
import { ru } from './translations/ru';
import { id } from './translations/id';
import { vi } from './translations/vi';
import { hi } from './translations/hi';
import { fa } from './translations/fa';
import { uz } from './translations/uz';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, type TranslationKeys } from './types';

describe('i18n localization dictionaries', () => {
  const dicts: Record<SupportedLanguage, TranslationKeys> = {
    en,
    tr,
    ru,
    id,
    vi,
    hi,
    fa,
    uz,
  };

  it('supports all 8 target languages with flags and native names', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual([
      'en',
      'tr',
      'ru',
      'id',
      'vi',
      'hi',
      'fa',
      'uz',
    ]);
  });

  it('ensures all translation keys match exactly across all 8 languages', () => {
    const enKeys = Object.keys(en).sort();
    for (const [code, dict] of Object.entries(dicts)) {
      const keys = Object.keys(dict).sort();
      expect(keys, `Mismatch in language: ${code}`).toEqual(enKeys);
    }
  });

  it('has non-empty values for every key in all 8 languages', () => {
    for (const [code, dict] of Object.entries(dicts)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${code} missing key ${key}`).toBeTruthy();
      }
    }
  });
});
