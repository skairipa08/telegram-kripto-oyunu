export type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  bottom_bar_bg_color?: string;
};

export type TelegramSafeAreaInset = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TelegramWebAppEvent =
  'themeChanged' | 'safeAreaChanged' | 'contentSafeAreaChanged';

export interface TelegramWebApp {
  readonly initData: string;
  readonly colorScheme: 'light' | 'dark';
  readonly themeParams: TelegramThemeParams;
  readonly safeAreaInset?: TelegramSafeAreaInset;
  readonly contentSafeAreaInset?: TelegramSafeAreaInset;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  enableClosingConfirmation?(): void;
  onEvent(event: TelegramWebAppEvent, callback: () => void): void;
  offEvent(event: TelegramWebAppEvent, callback: () => void): void;
  openInvoice?(
    url: string,
    callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void,
  ): void;
  openTelegramLink?(url: string): void;
  openLink?(url: string): void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}
