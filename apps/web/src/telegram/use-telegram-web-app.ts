import { useEffect, useState } from 'react';
import type {
  TelegramSafeAreaInset,
  TelegramThemeParams,
  TelegramWebApp,
  TelegramWebAppEvent,
} from './types';

const emptyInset: TelegramSafeAreaInset = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const themeVariables: Array<[keyof TelegramThemeParams, string]> = [
  ['bg_color', '--tg-theme-bg-color'],
  ['text_color', '--tg-theme-text-color'],
  ['hint_color', '--tg-theme-hint-color'],
  ['link_color', '--tg-theme-link-color'],
  ['button_color', '--tg-theme-button-color'],
  ['button_text_color', '--tg-theme-button-text-color'],
  ['secondary_bg_color', '--tg-theme-secondary-bg-color'],
  ['header_bg_color', '--tg-theme-header-bg-color'],
  ['bottom_bar_bg_color', '--tg-theme-bottom-bar-bg-color'],
];

function applyInset(prefix: string, inset = emptyInset) {
  const root = document.documentElement;
  root.style.setProperty(`${prefix}-top`, `${inset.top}px`);
  root.style.setProperty(`${prefix}-right`, `${inset.right}px`);
  root.style.setProperty(`${prefix}-bottom`, `${inset.bottom}px`);
  root.style.setProperty(`${prefix}-left`, `${inset.left}px`);
}

function applyTelegramAppearance(webApp: TelegramWebApp) {
  const root = document.documentElement;
  root.dataset.telegramTheme = webApp.colorScheme;

  for (const [telegramKey, cssVariable] of themeVariables) {
    const value = webApp.themeParams[telegramKey];
    if (value) root.style.setProperty(cssVariable, value);
    else root.style.removeProperty(cssVariable);
  }

  applyInset('--tg-safe-area-inset', webApp.safeAreaInset);
  applyInset('--tg-content-safe-area-inset', webApp.contentSafeAreaInset);

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  themeColor?.setAttribute(
    'content',
    webApp.themeParams.bg_color ??
      (webApp.colorScheme === 'light' ? '#f3f7f4' : '#07110f'),
  );
}

export function useTelegramWebApp() {
  const [webApp] = useState(() => window.Telegram?.WebApp ?? null);
  // DEV-ONLY: inject a stub initData when running outside Telegram so the
  // auth bypass in the API can be triggered without a real Telegram client.
  // import.meta.env.DEV is replaced with `false` by Vite in production builds.
  const initData =
    webApp?.initData.trim() || (import.meta.env.DEV ? 'dev_bypass=1' : null);

  useEffect(() => {
    if (!webApp) return;

    const syncAppearance = () => applyTelegramAppearance(webApp);
    const events: TelegramWebAppEvent[] = [
      'themeChanged',
      'safeAreaChanged',
      'contentSafeAreaChanged',
    ];

    syncAppearance();
    for (const event of events) webApp.onEvent(event, syncAppearance);

    webApp.ready();
    webApp.expand();
    if (typeof webApp.disableVerticalSwipes === 'function') {
      webApp.disableVerticalSwipes();
    }

    return () => {
      for (const event of events) webApp.offEvent(event, syncAppearance);
    };
  }, [initData, webApp]);

  return { webApp, initData };
}
