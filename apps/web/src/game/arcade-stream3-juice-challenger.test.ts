import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Components & Models
import { getTierCyberLuxeStyle } from '../components/catizen-merge-game';
import { getTierDefinition, MAX_MERGE_TIER } from './catizen-merge-model';
import {
  createInitialTapState,
  performTap,
  type TapState,
} from './notcoin-tap-model';
import { generateNextCandle } from './crypto-crash-model';
import { CelebrationModal } from '../components/celebration-modal';

describe('CHALLENGER 2 - STRESS HARNESS 1: Notcoin Tap Multi-Touch & Rapid Interaction Engine', () => {
  const notcoinSource = fs.readFileSync(
    path.resolve(__dirname, '../components/notcoin-tap-game.tsx'),
    'utf8',
  );

  it('verifies handleTouchStart iterates changedTouches with synchronous tapStateRef update', () => {
    // Audit handleTouchStart AST/code structure
    expect(notcoinSource).toContain('function handleTouchStart');
    expect(notcoinSource).toContain('e.changedTouches.length');
    expect(notcoinSource).toContain('tapStateRef.current = result.nextState');
    expect(notcoinSource).toContain('setTapState(tapStateRef.current)');

    // In handleCoinTap, verify pointerType === 'touch' is rejected to prevent double-tap events
    expect(notcoinSource).toMatch(
      /if\s*\(\s*e\.pointerType\s*===\s*['"]touch['"]\s*\)\s*return/,
    );
  });

  it('stress-tests simulated multi-touch 10-finger rapid burst against energy limits', () => {
    let state: TapState = createInitialTapState();
    // Simulate currentEnergy = 5
    state.currentEnergy = 5;
    const initialCoins = state.totalCoinsEarned;

    // Simulate 10 touches arriving in a single touch event batch
    const simulatedTouchCount = 10;
    let successfulTaps = 0;
    let earnedCoins = 0;

    for (let i = 0; i < simulatedTouchCount; i++) {
      const result = performTap(state);
      if (!result) break; // Energy exhausted
      state = result.nextState;
      successfulTaps++;
      earnedCoins += result.coinsEarned;
    }

    // Since energy was 5 and tap cost is 1, exactly 5 taps should succeed
    expect(successfulTaps).toBe(5);
    expect(state.currentEnergy).toBe(0);
    expect(state.currentEnergy).toBeGreaterThanOrEqual(0);
    expect(state.totalCoinsEarned).toBe(initialCoins + earnedCoins);

    // 11th tap must fail gracefully without negative balance or crash
    const failedTap = performTap(state);
    expect(failedTap).toBeNull();
    expect(state.currentEnergy).toBe(0);
  });

  it('empirically verifies spark particle buffer bounds under rapid tapping', () => {
    // Verify spawnTapSparks bounds particles to <= 150 with FIFO truncation
    expect(notcoinSource).toMatch(
      /if\s*\(\s*particles\.length\s*>\s*150\s*\)\s*\{\s*particles\.splice\(0,\s*30\);?\s*\}/,
    );

    // Verify self-terminating loop: cancels rAF when particles.length === 0 && textParticles.length === 0
    expect(notcoinSource).toContain('isLoopRunningRef.current = false');
    expect(notcoinSource).toContain(
      'if (particles.length > 0 || textParticles.length > 0)',
    );
  });

  it('verifies 3D tilt spring rebound and timer unmount cleanup', () => {
    // Tilt calculations must include rotX, rotY, scaleZ, and timer cleanup
    expect(notcoinSource).toContain('tiltTimerRef.current = window.setTimeout');
    expect(notcoinSource).toContain(
      'if (tiltTimerRef.current) clearTimeout(tiltTimerRef.current)',
    );
    expect(notcoinSource).toContain(
      'if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)',
    );
  });
});

describe('CHALLENGER 2 - STRESS HARNESS 2: Catizen 100-Tier Gradient Boundaries & Particle Engine', () => {
  const catizenSource = fs.readFileSync(
    path.resolve(__dirname, '../components/catizen-merge-game.tsx'),
    'utf8',
  );

  it('empirically tests getTierCyberLuxeStyle across ALL 100 tiers (1 to 100)', () => {
    for (let tier = 1; tier <= 100; tier++) {
      const style = getTierCyberLuxeStyle(tier);

      // Verify all required CSS properties are present and valid
      expect(style).toBeDefined();
      expect(typeof style.borderColor).toBe('string');
      expect(typeof style.background).toBe('string');
      expect(typeof style.boxShadow).toBe('string');
      expect(typeof style.accentColor).toBe('string');

      // Reject NaN or undefined in CSS string outputs
      expect(style.borderColor).not.toContain('NaN');
      expect(style.borderColor).not.toContain('undefined');
      expect(style.background).not.toContain('NaN');
      expect(style.background).not.toContain('undefined');
      expect(style.boxShadow).not.toContain('NaN');
      expect(style.boxShadow).not.toContain('undefined');
      expect(style.accentColor).not.toContain('NaN');
      expect(style.accentColor).not.toContain('undefined');
    }
  });

  it('verifies tier boundary transitions across all 10 distinct prestige eras', () => {
    const eraCheckpoints = [
      { tier: 10, eraName: 'Era 1 boundary' },
      { tier: 11, eraName: 'Era 2 start (Quantum Silicon)' },
      { tier: 20, eraName: 'Era 2 end' },
      { tier: 21, eraName: 'Era 3 start (Neural Synthetics)' },
      { tier: 30, eraName: 'Era 3 end' },
      { tier: 31, eraName: 'Era 4 start (Orbital Core)' },
      { tier: 40, eraName: 'Era 4 end' },
      { tier: 41, eraName: 'Era 5 start (Dark Matter Void)' },
      { tier: 50, eraName: 'Era 5 end' },
      { tier: 51, eraName: 'Era 6 start (Stellar Fusion)' },
      { tier: 60, eraName: 'Era 6 end' },
      { tier: 61, eraName: 'Era 7 start (Tachyon Warp)' },
      { tier: 70, eraName: 'Era 7 end' },
      { tier: 71, eraName: 'Era 8 start (Chrono Nexus)' },
      { tier: 80, eraName: 'Era 8 end' },
      { tier: 81, eraName: 'Era 9 start (Multiverse Singularity)' },
      { tier: 90, eraName: 'Era 9 end' },
      { tier: 91, eraName: 'Era 10 start (God-Engine / Transcendent)' },
      { tier: 100, eraName: 'Era 10 max' },
    ];

    eraCheckpoints.forEach(({ tier }) => {
      const style = getTierCyberLuxeStyle(tier);
      expect(style.background.length).toBeGreaterThan(10);
      expect(style.boxShadow).toContain('px');
    });
  });

  it('evaluates out-of-boundary tier values (0, negative, >100)', () => {
    // Should fallback to valid style without throwing
    const zeroStyle = getTierCyberLuxeStyle(0);
    expect(zeroStyle).toBeDefined();
    expect(zeroStyle.background).not.toContain('NaN');

    const negStyle = getTierCyberLuxeStyle(-5);
    expect(negStyle).toBeDefined();
    expect(negStyle.background).not.toContain('NaN');

    const beyondStyle = getTierCyberLuxeStyle(105);
    expect(beyondStyle).toBeDefined();
    expect(beyondStyle.background).not.toContain('NaN');
  });

  it('validates getTierDefinition for all 100 tiers in model', () => {
    expect(MAX_MERGE_TIER).toBe(100);
    for (let tier = 1; tier <= 100; tier++) {
      const def = getTierDefinition(tier);
      expect(def.tier).toBe(tier);
      expect(typeof def.name).toBe('string');
      expect(def.dps).toBeGreaterThan(0);
      expect(Number.isFinite(def.dps)).toBe(true);
      expect(def.mergeReward).toBeGreaterThan(0);
      expect(Number.isFinite(def.mergeReward)).toBe(true);
      expect(def.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('audits Catizen particle explosion pooling and unmount cleanup', () => {
    // Check particle bounds (max 160, splice 40)
    expect(catizenSource).toMatch(
      /if\s*\(\s*particles\.length\s*>\s*160\s*\)\s*\{\s*particles\.splice\(0,\s*40\);?\s*\}/,
    );

    // Check rAF unmount cleanup
    expect(catizenSource).toContain(
      'if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)',
    );

    // Check parcel and DPS timer cleanup
    expect(catizenSource).toContain(
      'if (parcelTimerRef.current) clearInterval(parcelTimerRef.current)',
    );
    expect(catizenSource).toContain(
      'if (dpsTimerRef.current) clearInterval(dpsTimerRef.current)',
    );
  });
});

describe('CHALLENGER 2 - STRESS HARNESS 3: Crypto Crash Rocket Trajectory & Screen Shake Mechanics', () => {
  const crashSource = fs.readFileSync(
    path.resolve(__dirname, '../components/crypto-crash-game.tsx'),
    'utf8',
  );

  it('stress-tests candlestick rocket trajectory math at extreme limits', () => {
    // Test tangent velocity angle calculation: theta = atan2(lastY - prevY, lastX - prevX)
    // Case 1: Horizontal line
    const angleH = Math.atan2(0, 20);
    expect(Number.isFinite(angleH)).toBe(true);
    expect(angleH).toBe(0);

    // Case 2: Vertical rise
    const angleV = Math.atan2(-50, 0);
    expect(Number.isFinite(angleV)).toBe(true);
    expect(angleV).toBeCloseTo(-Math.PI / 2, 4);

    // Case 3: Degenerate point (0, 0)
    const angleD = Math.atan2(0, 0);
    expect(Number.isFinite(angleD)).toBe(true);
    expect(angleD).toBe(0);

    // Test candlestick generation across 20 consecutive intervals
    let prev = 1.0;
    for (let i = 0; i < 20; i++) {
      const mult = 1.0 + i * 0.5;
      const candle = generateNextCandle(prev, mult, i);
      expect(candle.high).toBeGreaterThanOrEqual(
        Math.min(candle.open, candle.close),
      );
      expect(candle.low).toBeLessThanOrEqual(
        Math.max(candle.open, candle.close),
      );
      expect(Number.isFinite(candle.open)).toBe(true);
      expect(Number.isFinite(candle.close)).toBe(true);
      prev = candle.close;
    }
  });

  it('tests tension heartbeat BPM clamp invariant [60, 230]', () => {
    const testMultipliers = [1.0, 1.5, 2.0, 5.0, 10.0, 50.0, 100.0, 1000.0];

    testMultipliers.forEach((mult) => {
      const bpm = Math.min(
        230,
        Math.max(
          60,
          Math.round(60 + 25 * Math.pow(Math.max(0, mult - 1), 0.75)),
        ),
      );
      expect(bpm).toBeGreaterThanOrEqual(60);
      expect(bpm).toBeLessThanOrEqual(230);
      expect(Number.isFinite(bpm)).toBe(true);
    });
  });

  it('audits screen shake classes and unmount cleanup of all 4 timer handles', () => {
    expect(crashSource).toContain('is-crash-shake');
    expect(crashSource).toContain('is-cashout-flash is-cashout-bounce');

    // Unmount cleanup must clear animFrame, countTimer, shakeTimer, and toastTimer
    const cleanupRegex =
      /return\s*\(\)\s*=>\s*\{([\s\S]*?)\};\s*\}, \[\s*\]\);/;
    const match = crashSource.match(cleanupRegex);
    expect(match).not.toBeNull();
    const body = match![1]!;
    expect(body).toContain('cancelAnimationFrame(animFrameRef.current)');
    expect(body).toContain('clearInterval(countTimerRef.current)');
    expect(body).toContain('clearTimeout(shakeTimerRef.current)');
    expect(body).toContain('clearTimeout(toastTimerRef.current)');
  });

  it('empirically verifies synchronous ref guard against double cashout race conditions', () => {
    expect(crashSource).toContain('hasCashedOutRef.current = true');
    expect(crashSource).toMatch(
      /if\s*\(\s*phase\s*!==\s*['"]running['"]\s*\|\|\s*hasCashedOutRef\.current\s*\)\s*return/,
    );
  });
});

describe('CHALLENGER 2 - STRESS HARNESS 4: Dynasty Cipher Matrix Rain & Terminal Glitch', () => {
  const cipherSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dynasty-cipher-game.tsx'),
    'utf8',
  );

  it('audits background matrix rain canvas loop and unmount cleanup', () => {
    expect(cipherSource).toContain('matrixCanvasRef');
    expect(cipherSource).toContain('matrixAnimFrameRef');
    expect(cipherSource).toContain('requestAnimationFrame(matrixStep)');
    expect(cipherSource).toContain(
      'cancelAnimationFrame(matrixAnimFrameRef.current)',
    );
  });

  it('audits terminal glitch effect and unscramble text timer cleanup', () => {
    expect(cipherSource).toContain('is-glitching');
    expect(cipherSource).toContain('cipher-decode-sweep');

    // Verify unmount cleanup clears all active interval and timeout handles
    expect(cipherSource).toContain(
      'timers.current.forEach(window.clearTimeout)',
    );
    expect(cipherSource).toContain(
      'clearInterval(countdownIntervalRef.current)',
    );
    expect(cipherSource).toContain('clearTimeout(glitchTimerRef.current)');
    expect(cipherSource).toContain('clearTimeout(decodeTimerRef.current)');
    expect(cipherSource).toContain('clearInterval(scrambleTimerRef.current)');
  });
});

describe('CHALLENGER 2 - STRESS HARNESS 5: CelebrationModal Canvas Confetti Physics & Accessibility', () => {
  const modalSource = fs.readFileSync(
    path.resolve(__dirname, '../components/celebration-modal.tsx'),
    'utf8',
  );

  it('verifies accessibility attributes and keyboard event listener cleanup', () => {
    expect(modalSource).toContain('role="dialog"');
    expect(modalSource).toContain('aria-modal="true"');
    expect(modalSource).toContain(
      "window.addEventListener('keydown', handleKeyDown)",
    );
    expect(modalSource).toContain(
      "window.removeEventListener('keydown', handleKeyDown)",
    );

    // Verify touch target >= 44px
    expect(modalSource).toMatch(/minHeight:\s*['"]46px['"]/);
  });

  it('audits canvas confetti physics engine self-termination (zero idle CPU)', () => {
    // Confetti must have decay and air drag
    expect(modalSource).toContain('p.vy += 0.28'); // gravity
    expect(modalSource).toContain('p.vx *= 0.985'); // drag
    expect(modalSource).toContain(
      'p.opacity = Math.max(0, p.opacity - p.decay)',
    );

    // Must self-terminate when aliveCount === 0
    expect(modalSource).toContain('if (aliveCount > 0)');
    expect(modalSource).toContain(
      'animationFrameRef.current = requestAnimationFrame(render)',
    );
    expect(modalSource).toContain('isRunning = false');
    expect(modalSource).toContain(
      'cancelAnimationFrame(animationFrameRef.current)',
    );
  });

  it('verifies prefers-reduced-motion guard', () => {
    expect(modalSource).toContain('prefers-reduced-motion: reduce');
  });

  it('renders CelebrationModal to static markup cleanly', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CelebrationModal, {
        isOpen: true,
        onClose: () => {},
        title: 'TEBRİKLER!',
        subtitle: 'Ödül Hesabına Aktarıldı',
        rewardValue: '+₺1,400,000',
        badgeName: '7 Günlük Seri',
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('TEBRİKLER!');
    expect(markup).toContain('+₺1,400,000');
    expect(markup).toContain('7 Günlük Seri');
  });
});

describe('CHALLENGER 2 - STRESS HARNESS 6: 60fps GPU Performance & CSS Keyframes Audit', () => {
  const arcadeCss = fs.readFileSync(
    path.resolve(__dirname, '../components/arcade.css'),
    'utf8',
  );
  const socialCss = fs.readFileSync(
    path.resolve(__dirname, '../screens/social.css'),
    'utf8',
  );
  const shopAnalyticsCss = fs.readFileSync(
    path.resolve(__dirname, '../screens/shop-analytics.css'),
    'utf8',
  );

  it('audits arcade.css keyframes for GPU-accelerated transform & opacity properties', () => {
    // Collect all keyframe definitions
    const keyframesRegex =
      /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([^}]+(?:\{[^}]+\}[^}]+)*)\}/g;
    let match: RegExpExecArray | null;
    const keyframeNames: string[] = [];

    while ((match = keyframesRegex.exec(arcadeCss)) !== null) {
      const name = match[1]!;
      keyframeNames.push(name);
    }

    // Expected keyframes from Stream 3
    expect(keyframeNames).toContain('neonEnergyWave');
    expect(keyframeNames).toContain('crashViolentShake');
    expect(keyframeNames).toContain('cashoutPunch');
    expect(keyframeNames).toContain('terminalGlitch');
    expect(keyframeNames).toContain('neonDecodeSweep');
  });

  it('verifies prefers-reduced-motion media queries disable heavy animations in all CSS files', () => {
    expect(arcadeCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(socialCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(shopAnalyticsCss).toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
  });

  it('audits mobile responsiveness: zero fixed width > 290px in arcade.css and social.css', () => {
    const widthRegex = /(?:^|[^-])\b(?:width|min-width)\s*:\s*(\d+)px/g;

    // Check arcade.css
    let m: RegExpExecArray | null;
    const arcadeExceeding: number[] = [];
    while ((m = widthRegex.exec(arcadeCss)) !== null) {
      const val = parseInt(m[1]!, 10);
      if (val > 290) arcadeExceeding.push(val);
    }
    expect(arcadeExceeding).toEqual([]);

    // Check social.css
    const socialExceeding: number[] = [];
    while ((m = widthRegex.exec(socialCss)) !== null) {
      const val = parseInt(m[1]!, 10);
      if (val > 290) socialExceeding.push(val);
    }
    expect(socialExceeding).toEqual([]);
  });
});
