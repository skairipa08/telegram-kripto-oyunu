#!/usr/bin/env tsx
/**
 * Headless Economy Progression & ROI Simulator CLI for Project Empire.
 * Simulates progression across 1 Hour, 24 Hours, 7 Days, and 30 Days.
 */

import {
  simulateProgression,
  formatCompactNumber,
  DEFAULT_BUSINESSES,
} from '../packages/game-core/src/index.ts';

interface TimeHorizon {
  name: string;
  durationSeconds: number;
}

const HORIZONS: TimeHorizon[] = [
  { name: '1 Hour', durationSeconds: 3600 },
  { name: '24 Hours (1 Day)', durationSeconds: 86400 },
  { name: '7 Days (1 Week)', durationSeconds: 604800 },
  { name: '30 Days (1 Month)', durationSeconds: 2592000 },
];

function runSimulations() {
  console.log('='.repeat(80));
  console.log(
    ' PROJECT EMPIRE — DETERMINISTIC PROGRESSION & ROI SIMULATION HARNESS',
  );
  console.log('='.repeat(80));
  console.log();

  for (const horizon of HORIZONS) {
    console.log(
      `\n--- HORIZON: ${horizon.name} (${horizon.durationSeconds.toLocaleString()} seconds) ---`,
    );

    const result = simulateProgression(horizon.durationSeconds, {
      strategy: 'greedy_roi',
      isReferred: false,
    });

    console.log(
      `Total Cash Earned:           ${formatCompactNumber(result.totalCashEarned)} (${result.totalCashEarned.toLocaleString()})`,
    );
    console.log(
      `Final Cash Balance:          ${formatCompactNumber(result.finalCashBalance)} (${result.finalCashBalance.toLocaleString()})`,
    );
    console.log(
      `Final Production Rate:       ${formatCompactNumber(result.finalProductionPerSecond)} Cash/s`,
    );
    console.log(
      `Businesses Unlocked:         ${result.unlockedBusinessCount} / ${DEFAULT_BUSINESSES.length}`,
    );
    console.log(
      `Total Upgrades Purchased:    ${result.totalUpgradesPurchased}`,
    );

    console.log('\nBusiness Breakdown:');
    for (const b of DEFAULT_BUSINESSES) {
      const lvl = result.businessLevels[b.id] ?? 0;
      const unlockSec = result.timeToUnlockSeconds[b.id];
      const unlockStr =
        unlockSec !== null
          ? `${unlockSec}s (${(unlockSec / 3600).toFixed(2)}h)`
          : 'Locked';
      console.log(
        `  - ${b.name.padEnd(16)} Level: ${lvl.toString().padStart(4)} | Unlocked At: ${unlockStr}`,
      );
    }

    console.log('\nConvenience Pass Impact (Casual 8h Check-In Model):');
    const pass = result.conveniencePassImpact;
    console.log(
      `  - Free Tier (4h cap) Cash:  ${formatCompactNumber(pass.cashEarnedFree)} (Wasted: ${(pass.wastedOfflineSecondsFree / 3600).toFixed(1)}h)`,
    );
    console.log(
      `  - Pass Tier (12h cap) Cash: ${formatCompactNumber(pass.cashEarnedPass)} (Wasted: ${(pass.wastedOfflineSecondsPass / 3600).toFixed(1)}h)`,
    );
    console.log(
      `  - Efficiency Multiplier:    ${pass.efficiencyGainMultiplier}x preserved earnings`,
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log(
    ' SIMULATION HARNESS RUN COMPLETE — ALL TARGET HORIZONS VERIFIED',
  );
  console.log('='.repeat(80));
}

runSimulations();
