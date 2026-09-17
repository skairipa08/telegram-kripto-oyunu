export type SupportedLanguage = 'en' | 'tr' | 'ru' | 'id' | 'vi' | 'hi' | 'fa' | 'uz';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbekcha', flag: '🇺🇿' },
];

export interface TranslationKeys {
  // Navigation Tabs
  nav_empire: string;
  nav_arcade: string;
  nav_missions: string;
  nav_friends: string;
  nav_leaderboard: string;
  nav_shop: string;
  nav_admin: string;

  // Header / Top Bar
  header_cash: string;
  header_season_points: string;
  header_level: string;
  header_account: string;
  header_logout: string;
  header_logging_out: string;
  header_connected_as: string;
  header_play_zone: string;

  // Empire Screen
  empire_title: string;
  empire_eyebrow: string;
  empire_description: string;
  empire_collect_all: string;
  empire_claimable: string;
  empire_per_sec: string;
  empire_upgrade: string;
  empire_max_level: string;
  empire_invite_banner_title: string;
  empire_invite_banner_desc: string;

  // Arcade / Mini-games
  arcade_title: string;
  arcade_eyebrow: string;
  arcade_description: string;
  arcade_tab_tap: string;
  arcade_tab_merge: string;
  arcade_tab_crash: string;
  arcade_tab_mines: string;
  arcade_tab_predictions: string;
  arcade_tab_combo: string;
  arcade_tab_cipher: string;
  arcade_tab_mint: string;

  // Common UI
  btn_confirm: string;
  btn_cancel: string;
  btn_close: string;
  btn_collect: string;
  btn_copy: string;
  btn_copied: string;
  btn_retry: string;
  status_loading: string;
  status_success: string;
  status_error: string;
}
