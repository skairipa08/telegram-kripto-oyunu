/**
 * Project Empire — Telegram Tunnel & Bot Menu Button Configurator
 */

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  '8623512569:AAFTy5JE3vZjPBHOoCiEVxaCypk9E7hIOI4';
const NGROK_BIN = process.env.NGROK_BIN || 'C:\\ngrok\\ngrok.exe';
const PORT = 5173;

async function getActiveNgrokTunnel(): Promise<string | null> {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels', {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      tunnels: Array<{ proto: string; public_url: string }>;
    };
    const httpsTunnel = data.tunnels.find((t) => t.proto === 'https');
    return httpsTunnel?.public_url ?? null;
  } catch {
    return null;
  }
}

async function startNgrok(): Promise<string | null> {
  console.log(`[ngrok] Baslatiliyor: ${NGROK_BIN} http ${PORT}...`);
  try {
    const child = spawn(NGROK_BIN, ['http', String(PORT)], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch (err) {
    console.error('[ngrok] Baslatilamadi:', err);
    return null;
  }

  // Tünel URL'sinin açılmasını bekle (maksimum 12 saniye)
  for (let i = 0; i < 12; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const url = await getActiveNgrokTunnel();
    if (url) return url;
  }
  return null;
}

async function updateBotMenuButton(url: string): Promise<boolean> {
  console.log(`[bot] Menu butonu baglaniyor -> ${url}`);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: 'Oyna 🎮',
            web_app: { url },
          },
        }),
      },
    );
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (json.ok) {
      console.log('[bot] Menu butonu basariyla guncellendi!');
      return true;
    }
    console.warn('[bot] Telegram uyarisi:', json.description);
    return false;
  } catch (err) {
    console.error('[bot] Telegram API hatasi:', err);
    return false;
  }
}

function updateDevVars(url: string): void {
  const devVarsPath = path.resolve(__dirname, '../apps/api/.dev.vars');
  try {
    let content = readFileSync(devVarsPath, 'utf8');
    content = content.replace(/APP_ORIGIN=.*/g, `APP_ORIGIN=${url}`);
    writeFileSync(devVarsPath, content, 'utf8');
    console.log(`[dev.vars] APP_ORIGIN = ${url} olarak guncellendi.`);
  } catch (err) {
    console.warn('[dev.vars] Guncellenemedi:', err);
  }
}

async function main() {
  console.log('\n=======================================================');
  console.log('Project Empire - Telegram Mini App Baglanti Yardimcisi');
  console.log('=======================================================');

  let tunnelUrl = await getActiveNgrokTunnel();
  if (tunnelUrl) {
    console.log(`[ngrok] Calisan aktif tunel bulundu: ${tunnelUrl}`);
  } else {
    tunnelUrl = await startNgrok();
  }

  if (!tunnelUrl) {
    console.error(
      "\n[HATA] ngrok tuneli olusturulamadi! Lutfen ngrok'un kurulu oldugundan emin olun.",
    );
    process.exit(1);
  }

  updateDevVars(tunnelUrl);
  await updateBotMenuButton(tunnelUrl);

  console.log('\n=======================================================');
  console.log('TAMAMLANDI! Telegram uzerinde test edebilirsiniz:');
  console.log(`-> Bot:      https://t.me/PemtokenBot`);
  console.log(`-> Mini App: ${tunnelUrl}`);
  console.log('=======================================================\n');
}

main().catch((err) => {
  console.error('Beklenmeyen hata:', err);
  process.exit(1);
});
