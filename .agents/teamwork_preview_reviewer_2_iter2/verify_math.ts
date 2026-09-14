import {
  calculatePaybackPeriodSeconds,
  calculateMarginalRoi,
  calculateOptimalNextUpgrade,
  formatCompactNumber,
  calculateProductionPerSecond,
  calculateUpgradeCost,
  calculateMilestoneMultiplier,
  simulateProgression,
  DEFAULT_BUSINESSES,
  DEFAULT_ECONOMY_CONFIG,
} from '../../packages/game-core/src/index';

console.log('========================================================================');
console.log('REVIEWER 2 INDEPENDENT MATHEMATICAL & SIMULATION VERIFICATION SUITE');
console.log('========================================================================');

let allPassed = true;
function check(name: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    allPassed = false;
    console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
  }
}

// ------------------------------------------------------------------------
// 1. VERIFY calculatePaybackPeriodSeconds & calculateMarginalRoi ACROSS 6 TIERS
// ------------------------------------------------------------------------
console.log('\n--- 1. Payback Period & Marginal ROI Verification across 6 Tiers ---');

const expectedUnlockPaybacks: Record<string, number> = {
  street_stand: 100, // 100 / 1
  cafe: 2500 / 12, // 208.333...
  delivery_hub: 25000 / 90, // 277.777...
  factory: 250000 / 600, // 416.666...
  tech_company: 3000000 / 5000, // 600
  global_holding: 50000000 / 60000, // 833.333...
};

for (const b of DEFAULT_BUSINESSES) {
  const cost0 = calculateUpgradeCost(b.baseCost, 0);
  const p0 = calculateProductionPerSecond(b.baseIncome, 0);
  const p1 = calculateProductionPerSecond(b.baseIncome, 1);
  const payback = calculatePaybackPeriodSeconds(cost0, p0, p1);
  const roi = calculateMarginalRoi(cost0, p0, p1);
  const expectedPayback = expectedUnlockPaybacks[b.id]!;

  check(
    `Tier ${b.id} Unlock: payback matches expected (${payback.toFixed(2)}s == ${expectedPayback.toFixed(2)}s)`,
    Math.abs(payback - expectedPayback) < 1e-6,
  );
  check(
    `Tier ${b.id} Unlock: marginalRoi matches 1/payback (${roi.toFixed(6)} == ${(1 / expectedPayback).toFixed(6)})`,
    Math.abs(roi - 1 / expectedPayback) < 1e-9,
  );
}

// Check boundary math for payback
check('Payback: cost <= 0 returns 0', calculatePaybackPeriodSeconds(0, 10, 20) === 0 && calculatePaybackPeriodSeconds(-50, 10, 20) === 0);
check('Payback: delta <= 0 returns Infinity', calculatePaybackPeriodSeconds(100, 20, 20) === Number.POSITIVE_INFINITY && calculatePaybackPeriodSeconds(100, 20, 10) === Number.POSITIVE_INFINITY);
check('Payback: sub-epsilon delta <= 1e-9 returns Infinity', calculatePaybackPeriodSeconds(100, 0, 1e-10) === Number.POSITIVE_INFINITY && calculatePaybackPeriodSeconds(100, 0, 1e-9) === Number.POSITIVE_INFINITY);
check('Payback: delta > 1e-9 returns finite', Number.isFinite(calculatePaybackPeriodSeconds(100, 0, 2e-9)));
check('Payback: NaN cost or prod returns Infinity', calculatePaybackPeriodSeconds(NaN, 10, 20) === Number.POSITIVE_INFINITY && calculatePaybackPeriodSeconds(100, NaN, 20) === Number.POSITIVE_INFINITY && calculatePaybackPeriodSeconds(100, 10, NaN) === Number.POSITIVE_INFINITY);
check('Payback: infinite cost returns Infinity', calculatePaybackPeriodSeconds(Number.POSITIVE_INFINITY, 10, 20) === Number.POSITIVE_INFINITY);
check('Payback: infinite nextProd returns 0', calculatePaybackPeriodSeconds(100, 10, Number.POSITIVE_INFINITY) === 0);

// Check boundary math for marginalRoi
check('ROI: cost <= 0 returns Infinity', calculateMarginalRoi(0, 10, 20) === Number.POSITIVE_INFINITY);
check('ROI: delta <= 0 returns 0', calculateMarginalRoi(100, 20, 20) === 0 && calculateMarginalRoi(100, 20, 10) === 0);

// Check milestone leap impact across all milestones
for (const level of [10, 25, 50, 100, 150]) {
  const prevLevel = level - 1;
  const cost = calculateUpgradeCost(100, level);
  const pPrev = calculateProductionPerSecond(1, prevLevel);
  const pNext = calculateProductionPerSecond(1, level);
  const payback = calculatePaybackPeriodSeconds(cost, pPrev, pNext);
  const roi = calculateMarginalRoi(cost, pPrev, pNext);
  check(
    `Milestone Level ${level}: produces positive gain and finite payback (${payback.toFixed(2)}s)`,
    payback > 0 && Number.isFinite(payback) && roi > 0,
  );
}

// ------------------------------------------------------------------------
// 2. VERIFY calculateOptimalNextUpgrade DETERMINISTIC RANKING & CANDIDATE EVALUATION
// ------------------------------------------------------------------------
console.log('\n--- 2. Deterministic Next Upgrade Ranking & Candidate Evaluation ---');

// Test A: Empty list
const emptyEval = calculateOptimalNextUpgrade([]);
check('Empty businesses: bestOverall is null', emptyEval.bestOverall === null);
check('Empty businesses: bestAffordable is null', emptyEval.bestAffordable === null);
check('Empty businesses: candidates is empty array', emptyEval.candidates.length === 0);

// Test B: All 6 businesses at Level 0 with starter cash (100)
const starterBiz = DEFAULT_BUSINESSES.map((b) => ({
  slug: b.id,
  name: b.name,
  level: 0,
  baseCost: b.baseCost,
  baseIncome: b.baseIncome,
}));

const starterEval100 = calculateOptimalNextUpgrade(starterBiz, 100);
check('Starter with 100 cash: bestOverall is street_stand', starterEval100.bestOverall?.slug === 'street_stand');
check('Starter with 100 cash: bestAffordable is street_stand', starterEval100.bestAffordable?.slug === 'street_stand');
check('Starter with 100 cash: street_stand isAffordable is true', starterEval100.bestOverall?.isAffordable === true);
check('Starter with 100 cash: cafe isAffordable is false', starterEval100.candidates.find(c => c.slug === 'cafe')?.isAffordable === false);

// Test C: 0 cash
const starterEval0 = calculateOptimalNextUpgrade(starterBiz, 0);
check('Starter with 0 cash: bestOverall is street_stand', starterEval0.bestOverall?.slug === 'street_stand');
check('Starter with 0 cash: bestAffordable is null', starterEval0.bestAffordable === null);
check('Starter with 0 cash: street_stand isAffordable is false', starterEval0.bestOverall?.isAffordable === false);

// Test D: Deterministic multi-key tie-breaking:
// 1. payback ASC, 2. upgradeCost ASC, 3. slug ASC
const tieTestBiz = [
  { slug: 'beta_biz', name: 'Beta', level: 1, baseCost: 300, baseIncome: 3 }, // payback = 300 / 3 = 100
  { slug: 'alpha_biz', name: 'Alpha', level: 1, baseCost: 300, baseIncome: 3 }, // payback = 100, same cost, alpha < beta
  { slug: 'gamma_cheap', name: 'Gamma Cheap', level: 1, baseCost: 100, baseIncome: 1 }, // payback = 100, cost 100 < 300 -> beats both!
  { slug: 'fast_payback', name: 'Fast Payback', level: 1, baseCost: 500, baseIncome: 20 }, // payback = 500 / 20 = 25 -> beats all!
];

// Shuffled orders to test permutation invariance
const perm1 = calculateOptimalNextUpgrade(tieTestBiz, 1000);
const perm2 = calculateOptimalNextUpgrade([...tieTestBiz].reverse(), 1000);
const perm3 = calculateOptimalNextUpgrade([tieTestBiz[1]!, tieTestBiz[3]!, tieTestBiz[0]!, tieTestBiz[2]!], 1000);

check('Ranking order: key 1 payback selects fast_payback first', perm1.candidates[0]?.slug === 'fast_payback');
check('Ranking order: key 2 cost selects gamma_cheap second', perm1.candidates[1]?.slug === 'gamma_cheap');
check('Ranking order: key 3 slug selects alpha_biz third', perm1.candidates[2]?.slug === 'alpha_biz');
check('Ranking order: key 3 slug selects beta_biz fourth', perm1.candidates[3]?.slug === 'beta_biz');

check('Permutation Invariance across different input orders',
  JSON.stringify(perm1.candidates.map(c => c.slug)) === JSON.stringify(perm2.candidates.map(c => c.slug)) &&
  JSON.stringify(perm1.candidates.map(c => c.slug)) === JSON.stringify(perm3.candidates.map(c => c.slug))
);

// ------------------------------------------------------------------------
// 3. VERIFY formatCompactNumber FOR NUMBERS, STRINGS, AND BIGINTS UP TO 10^15+
// ------------------------------------------------------------------------
console.log('\n--- 3. Safe Compact Number Formatting Verification ---');

const formatCases: [number | bigint | string, string][] = [
  [0, '0'],
  [42, '42'],
  [999, '999'],
  [1000, '1K'],
  [1200, '1.2K'],
  [9500, '9.5K'],
  [999949, '999.9K'],
  [999950, '1M'], // Tier bumping from K to M
  [1000000, '1M'],
  [3500000, '3.5M'],
  [999950000, '1B'], // Tier bumping from M to B
  [1000000000, '1B'],
  [12800000000, '12.8B'],
  [1000000000000, '1T'],
  [4500000000000, '4.5T'],
  [999950000000000, '1Q'], // Tier bumping from T to Q (10^15)
  [1000000000000000, '1Q'], // 10^15
  [2500000000000000, '2.5Q'],
  [1000000000000000000, '1Qi'], // 10^18 Quintillion
  [1000000000000000n, '1Q'], // BigInt 10^15
  [2500000000000000n, '2.5Q'],
  [1000000000000000000n, '1Qi'], // BigInt 10^18
  ['1000', '1K'],
  [' 3500000 ', '3.5M'],
  [-1200, '-1.2K'],
  [-3500000, '-3.5M'],
  [-999950, '-1M'],
  [-1000000000000000n, '-1Q'],
  ['NaN', 'NaN'],
  [NaN, 'NaN'],
  ['Infinity', 'Infinity'],
  ['+Infinity', 'Infinity'],
  ['-Infinity', '-Infinity'],
  [Infinity, 'Infinity'],
  [-Infinity, '-Infinity'],
];

for (const [input, expected] of formatCases) {
  const result = formatCompactNumber(input);
  const displayInput = typeof input === 'bigint' ? input.toString() + 'n' : String(input);
  check(
    `formatCompactNumber(${displayInput}) === '${expected}' (got '${result}')`,
    result === expected,
  );
}

// ------------------------------------------------------------------------
// 4. VERIFY simulateProgression ACROSS 1H, 24H, 7D, 30D
// ------------------------------------------------------------------------
console.log('\n--- 4. simulateProgression Verification across 1h, 24h, 7d, 30d ---');

const sim1h = simulateProgression(3600);
const sim24h = simulateProgression(86400);
const sim7d = simulateProgression(604800);
const sim30d = simulateProgression(2592000);

// A. Monotonicity & progression metrics
check('1h < 24h totalCashEarned', sim1h.totalCashEarned < sim24h.totalCashEarned);
check('24h < 7d totalCashEarned', sim24h.totalCashEarned < sim7d.totalCashEarned);
check('7d < 30d totalCashEarned', sim7d.totalCashEarned < sim30d.totalCashEarned);

check('1h < 24h production rate', sim1h.finalProductionPerSecond < sim24h.finalProductionPerSecond);
check('24h < 7d production rate', sim24h.finalProductionPerSecond < sim7d.finalProductionPerSecond);
check('7d < 30d production rate', sim7d.finalProductionPerSecond < sim30d.finalProductionPerSecond);

check('1h < 24h upgrades purchased', sim1h.totalUpgradesPurchased < sim24h.totalUpgradesPurchased);
check('24h < 7d upgrades purchased', sim24h.totalUpgradesPurchased < sim7d.totalUpgradesPurchased);
check('7d < 30d upgrades purchased', sim7d.totalUpgradesPurchased < sim30d.totalUpgradesPurchased);

// B. Business unlocks: all 6 canonical businesses unlocked by 24h
check('24h has unlocked all 6 businesses', sim24h.unlockedBusinessCount === 6);
check('Street Stand unlocked at t=0', sim24h.timeToUnlockSeconds['street_stand'] === 0);
check('Sequential unlock ordering',
  sim24h.timeToUnlockSeconds['street_stand']! < sim24h.timeToUnlockSeconds['cafe']! &&
  sim24h.timeToUnlockSeconds['cafe']! < sim24h.timeToUnlockSeconds['delivery_hub']! &&
  sim24h.timeToUnlockSeconds['delivery_hub']! < sim24h.timeToUnlockSeconds['factory']! &&
  sim24h.timeToUnlockSeconds['factory']! < sim24h.timeToUnlockSeconds['tech_company']! &&
  sim24h.timeToUnlockSeconds['tech_company']! < sim24h.timeToUnlockSeconds['global_holding']!
);

// C. Anti-inflation & pacing dampening (Cost growth 1.18 vs Prod growth 1.07)
check('30d totalCashEarned is finite and positive', Number.isFinite(sim30d.totalCashEarned) && sim30d.totalCashEarned > 0);
check('30d production rate is finite and positive', Number.isFinite(sim30d.finalProductionPerSecond) && sim30d.finalProductionPerSecond > 0);
for (const b of DEFAULT_BUSINESSES) {
  const lvl = sim30d.businessLevels[b.id]!;
  check(
    `30d level for ${b.id} is bounded (< 250) due to 1.18 cost growth (actual: ${lvl})`,
    lvl > 0 && lvl < 250,
  );
}

// D. Convenience Pass Impact metrics
// In casual 8-hour check-in model:
// 24 hours has 3 intervals of 8h (28,800s):
// Free tier wastes 4h per interval = 12h wasted = 43,200s
// Pass tier wastes 0h
const pass24h = sim24h.conveniencePassImpact;
check('Convenience Pass: Free tier wastes exactly 12h in 24h run', pass24h.wastedOfflineSecondsFree === 12 * 3600);
check('Convenience Pass: Pass tier wastes 0h in 24h run', pass24h.wastedOfflineSecondsPass === 0);
check('Convenience Pass: Pass cash > Free cash', pass24h.cashEarnedPass > pass24h.cashEarnedFree);
check('Convenience Pass: Efficiency multiplier > 1.0', pass24h.efficiencyGainMultiplier > 1.0);

// Anti-P2W safety check:
const activeSimFree = simulateProgression(86400, { claimIntervalSeconds: 14400, hasConveniencePass: false });
const activeSimPass = simulateProgression(86400, { claimIntervalSeconds: 14400, hasConveniencePass: true });
check(
  'Anti-P2W Guardrail: 0% advantage when player claims within 4h cap',
  activeSimFree.totalCashEarned === activeSimPass.totalCashEarned &&
  activeSimFree.finalProductionPerSecond === activeSimPass.finalProductionPerSecond &&
  JSON.stringify(activeSimFree.businessLevels) === JSON.stringify(activeSimPass.businessLevels)
);

// ------------------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------------------
console.log('\n========================================================================');
if (allPassed) {
  console.log('ALL INDEPENDENT REVIEW CHECKS PASSED SUCCESSFULLY (100% GREEN)');
} else {
  console.error('ONE OR MORE INDEPENDENT REVIEW CHECKS FAILED');
  process.exit(1);
}
console.log('========================================================================');
