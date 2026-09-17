export type SupportedLanguage = 'en' | 'tr' | 'ru' | 'es' | 'id' | 'vi' | 'hi' | 'fa' | 'uz';

export interface LanguageInfo {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
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
  btn_share: string;
  status_loading: string;
  status_success: string;
  status_error: string;

  // Share Modal & Referral Virality
  share_modal_title: string;
  share_modal_subtitle: string;
  share_template_starter_label: string;
  share_template_starter_text: string;
  share_template_clan_label: string;
  share_template_clan_text: string;
  share_template_whale_label: string;
  share_template_whale_text: string;
  share_btn_telegram: string;
  share_btn_copy: string;
  share_direct_link: string;

  // Friends / Partners Screen
  friends_title: string;
  friends_eyebrow: string;
  friends_description: string;
  friends_tab_partners: string;
  friends_tab_clans: string;
  friends_invite_card_title: string;
  friends_invite_card_desc: string;
  friends_journey_title: string;
  friends_step_activation: string;
  friends_step_day2: string;
  friends_step_day7: string;
  friends_step_growth: string;
  friends_step_activation_desc: string;
  friends_step_day2_desc: string;
  friends_step_day7_desc: string;
  friends_step_growth_desc: string;
  friends_no_partners: string;
  friends_no_partners_desc: string;

  // Business Tiers in Empire
  tier_local: string;
  tier_tech: string;
  tier_quantum: string;
  tier_space: string;

  // Missions Screen
  missions_title: string;
  missions_eyebrow: string;
  missions_description: string;
  missions_tab_daily: string;
  missions_tab_social: string;
  missions_tab_special: string;
  missions_claim: string;
  missions_claimed: string;
  missions_chest_claim: string;
  missions_chest_claimed: string;
  missions_chest_claiming: string;
  missions_chest_title_unlocked: string;
  missions_chest_title_daily: string;
  missions_chest_sub_unlocked: string;
  missions_chest_sub_daily: string;

  // Empire Screen Additional
  empire_claiming: string;
  empire_collect_income: string;

  // Leaderboard Screen
  lb_title: string;
  lb_eyebrow: string;
  lb_description: string;
  lb_tab_all: string;
  lb_tab_weekly: string;
  lb_rank: string;

  // Shop Screen
  shop_title: string;
  shop_eyebrow: string;
  shop_description: string;
  shop_buy: string;
  shop_purchased: string;
  shop_sales_soon: string;
  shop_payment_opening: string;
  shop_pass_active: string;
  shop_pass_active_badge: string;
  shop_pass_buy: string;
}
