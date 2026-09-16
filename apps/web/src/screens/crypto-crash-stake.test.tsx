import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CryptoCrashGame, QUICK_CHIPS } from '../components/crypto-crash-game';

describe('CryptoCrashGame: Custom Free Stake Input and Real-Time Validation', () => {
  it('exports QUICK_CHIPS including 10, 50, 100, 250, 500', () => {
    expect(QUICK_CHIPS).toEqual([10, 50, 100, 250, 500]);
  });

  it('renders interactive numeric text input with accessible aria-label and currency tag', () => {
    const markup = renderToStaticMarkup(
      <CryptoCrashGame preview playerCash={2000} />,
    );

    expect(markup).toContain('<input');
    expect(markup).toContain('class="crash-stake-input"');
    expect(markup).toContain('type="text"');
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('aria-label="Yatırım Tutarı"');
    expect(markup).toContain('value="100"');
    expect(markup).toContain('crash-stake-currency');
    expect(markup).toContain('NAKİT');
    expect(markup).toContain('Bakiye: <strong>2000 Nakit</strong>');
  });

  it('renders all quick chips (+10, +50, +100, +250, +500, MAKS) with min-height touch targets', () => {
    const markup = renderToStaticMarkup(
      <CryptoCrashGame preview playerCash={1000} />,
    );

    expect(markup).toContain('+10');
    expect(markup).toContain('+50');
    expect(markup).toContain('+100');
    expect(markup).toContain('+250');
    expect(markup).toContain('+500');
    expect(markup).toContain('MAKS');

    // Default stake (100) should have active class on +100 chip
    expect(markup).toContain('crash-chip-btn active">+100</button>');
  });

  it('clamps initial stake to 10 when player has exactly 10 Cash and keeps button enabled', () => {
    const markup = renderToStaticMarkup(
      <CryptoCrashGame preview playerCash={10} />,
    );

    expect(markup).toContain('value="10"');
    expect(markup).toContain('crash-chip-btn active">+10</button>');
    expect(markup).not.toContain('crash-stake-validation-msg');
    expect(markup).toContain('🚀 BOĞA BAŞLAT (10 NAKİT)');
  });

  it('displays real-time validation error and disables launch button when player cash is under minimum', () => {
    const markup = renderToStaticMarkup(
      <CryptoCrashGame preview playerCash={0} />,
    );

    expect(markup).toContain('crash-stake-validation-msg');
    expect(markup).toContain('Yetersiz bakiye! Maksimum: 0 Nakit');
    expect(markup).toContain('has-error');
    // Button must be disabled
    expect(markup).toContain('disabled=""');
  });

  it('renders correctly with high player balance without overflow', () => {
    const markup = renderToStaticMarkup(
      <CryptoCrashGame preview playerCash={50000} />,
    );

    expect(markup).toContain('Bakiye: <strong>50000 Nakit</strong>');
    expect(markup).toContain('BOĞA BAŞLAT (100 NAKİT)');
    expect(markup).not.toContain('disabled=""');
  });
});
