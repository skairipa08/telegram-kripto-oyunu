/**
 * Pure deterministic Daily Combo and Daily Cipher puzzle logic for Project Empire.
 * Independent of network, database, or UI.
 */

import { DEFAULT_BUSINESSES } from './config';

export const MORSE_TABLE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
};

export const CIPHER_DICTIONARY = [
  'EMPIRE',
  'HOLDING',
  'STARS',
  'SATOSHI',
  'BITCOIN',
  'BLOCKCHAIN',
  'QUANTUM',
  'SYNDICATE',
  'CARTEL',
  'MINER',
  'PROVABLE',
  'FINTECH',
  'ORBITAL',
  'HARVEST',
  'DYNAMIC',
  'CAPITAL',
] as const;

export const DAILY_COMBO_REWARD = {
  cash: 250000,
  seasonPoints: 100,
} as const;

export const DAILY_CIPHER_REWARD = {
  cash: 100000,
  seasonPoints: 50,
} as const;

/**
 * Returns UTC date string in format YYYY-MM-DD.
 */
export function getUtcDateString(now = Date.now()): string {
  const d = new Date(now);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Deterministic pseudo-random number generator seed from string.
 * Jenkins 32-bit hash implementation.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Converts a text word into its Morse code representation separated by spaces.
 */
export function textToMorse(word: string): string {
  return word
    .toUpperCase()
    .split('')
    .map((char) => MORSE_TABLE[char] ?? '')
    .filter(Boolean)
    .join(' ');
}

export interface DailyComboConfig {
  readonly date: string;
  readonly comboSlugs: readonly [string, string, string];
  readonly comboNames: readonly [string, string, string];
  readonly rewardCash: number;
  readonly rewardSeasonPoints: number;
}

export interface DailyCipherConfig {
  readonly date: string;
  readonly word: string;
  readonly morseCode: string;
  readonly rewardCash: number;
  readonly rewardSeasonPoints: number;
}

/**
 * Deterministically generates the 3 secret business slugs for a given UTC date.
 */
export function getDailyCombo(dateStr = getUtcDateString()): DailyComboConfig {
  const seed = hashString(`empire_combo_v1_${dateStr}`);
  const businesses = [...DEFAULT_BUSINESSES];

  // Fisher-Yates shuffle with deterministic LCG
  let state = seed;
  for (let i = businesses.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const j = Math.floor((state / 4294967296) * (i + 1));
    const temp = businesses[i]!;
    businesses[i] = businesses[j]!;
    businesses[j] = temp;
  }

  const selected = businesses.slice(0, 3);
  const comboSlugs = [
    selected[0]!.id,
    selected[1]!.id,
    selected[2]!.id,
  ] as const;
  const comboNames = [
    selected[0]!.name,
    selected[1]!.name,
    selected[2]!.name,
  ] as const;

  return {
    date: dateStr,
    comboSlugs,
    comboNames,
    rewardCash: DAILY_COMBO_REWARD.cash,
    rewardSeasonPoints: DAILY_COMBO_REWARD.seasonPoints,
  };
}

/**
 * Deterministically selects the secret cipher word and Morse code for a given UTC date.
 */
export function getDailyCipher(
  dateStr = getUtcDateString(),
): DailyCipherConfig {
  const seed = hashString(`empire_cipher_v1_${dateStr}`);
  const index = seed % CIPHER_DICTIONARY.length;
  const word = CIPHER_DICTIONARY[index]!;
  const morseCode = textToMorse(word);

  return {
    date: dateStr,
    word,
    morseCode,
    rewardCash: DAILY_CIPHER_REWARD.cash,
    rewardSeasonPoints: DAILY_CIPHER_REWARD.seasonPoints,
  };
}

/**
 * Validates whether 3 player-submitted business slugs match the daily combo (order-independent).
 */
export function verifyDailyComboSelection(
  submittedSlugs: readonly string[],
  dateStr = getUtcDateString(),
): boolean {
  if (!Array.isArray(submittedSlugs) || submittedSlugs.length !== 3) {
    return false;
  }

  const { comboSlugs } = getDailyCombo(dateStr);
  const secretSet = new Set(comboSlugs);
  const submittedSet = new Set(submittedSlugs);

  if (submittedSet.size !== 3) {
    return false; // Duplicates not allowed
  }

  for (const slug of submittedSet) {
    if (!secretSet.has(slug)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates whether player submitted cipher text matches the daily word (case-insensitive).
 */
export function verifyDailyCipherSubmission(
  submittedText: string,
  dateStr = getUtcDateString(),
): boolean {
  if (!submittedText || typeof submittedText !== 'string') return false;
  const { word } = getDailyCipher(dateStr);
  return submittedText.trim().toUpperCase() === word;
}
