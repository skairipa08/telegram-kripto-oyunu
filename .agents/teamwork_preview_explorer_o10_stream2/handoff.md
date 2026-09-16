# Stream 2 Frontend Risk Game & Streak Milestone UI — Comprehensive Handoff Report

**Date & Time**: 2026-09-16T12:50:00Z  
**Agent**: Explorer Stream 2 (`teamwork_preview_explorer_o10_stream2`)  
**Parent**: `8f48bf32-e611-43f8-a20c-dc51691359a0`  
**Working Directory**: `c:\Users\Administrator\Desktop\telegram kripto oyunu\.agents\teamwork_preview_explorer_o10_stream2`  
**Status**: Exploration Complete & Implementation Ready  

---

## 1. Observation

### 1.1 Target Files & Existing Implementations

1. **`apps/web/src/components/crypto-crash-game.tsx`**:
   - Lines 34–35: State initializes stake with a fixed default:
     ```tsx
     const [stake, setStake] = useState<number>(100);
     ```
   - Lines 332–372: Stake selection only renders static chips from `DEFAULT_STAKES = [50, 100, 250, 500, 1000]`:
     ```tsx
     <div className="crash-stake-bar">
       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
         <span style={{ color: 'var(--muted)' }}>Yatırım Tutarı</span>
         <span style={{ color: 'var(--text)', fontWeight: 700 }}>{stake} Nakit</span>
       </div>
       <div className="crash-chips-row">
         {DEFAULT_STAKES.map((chip) => (
           <button
             key={chip}
             className={`crash-chip-btn ${stake === chip ? 'active' : ''}`}
             onClick={() => { setStake(chip); playTapSound(); }}
             disabled={phase === 'running' || phase === 'countdown'}
           >
             +{chip}
           </button>
         ))}
         <button
           className="crash-chip-btn"
           onClick={() => { setStake(Math.min(playerCash, 5000)); playTapSound(); }}
           disabled={phase === 'running' || phase === 'countdown'}
         >
           MAKS
         </button>
       </div>
     </div>
     ```
   - Current stake controls lack:
     - An editable `<input type="number">` or free-typing custom text box.
     - Direct input validation for `$10 \le \text{stake} \le \text{playerCash}$`.
     - The `+10` quick chip explicitly requested in the user prompt.
     - Real-time feedback when the user types an invalid or out-of-bounds amount.
   - Ref and lifecycle guards:
     - Line 50: `countTimerRef` for countdown interval cleanup.
     - Line 51: `hasCashedOutRef` preventing double cashout race conditions.
     - These guards are tested by `apps/web/src/game/arcade-stream2-challenger.test.ts` (probes 3 & 4) and must remain untouched.

2. **`apps/web/src/screens/missions-screen.tsx`**:
   - Lines 139–175: Currently only renders a 7-day weekly cycle:
     ```tsx
     const { missions, streak } = resource.data;
     ...
     const streakDays = Math.min(7, Math.max(0, streak));
     ...
     <article className="panel missions-streak">
       <div className="missions-streak-copy">
         <p className="eyebrow">GÜNLÜK SERİ</p>
         <h2>{formatNumber(streak)} gün</h2>
         <p className="muted">Her gün geri dönerek ritmini koru.</p>
       </div>
       <ol className="missions-week-strip" aria-label={`Yedi günlük seride ${streakDays} gün tamamlandı`}>
         {Array.from({ length: 7 }, (_, index) => {
           const done = index < streakDays;
           return (
             <li key={index} className={done ? 'is-done' : ''}>
               <span aria-hidden="true">{done ? '✓' : index + 1}</span>
               <small>{index + 1}. gün</small>
             </li>
           );
         })}
       </ol>
     </article>
     ```
   - Lacks any visual presentation for the long-term compounding milestones required by R3:
     - 7 Days: 1.0x SRU + 500 Cash
     - 30 Days (1 Month): 2.5x SRU + 5,000 Cash
     - 90 Days (3 Months): 5.0x SRU + 25,000 Cash
     - 180 Days (6 Months): 10.0x SRU + 100,000 Cash
     - 365 Days (1 Year): 25.0x SRU + 500,000 Cash + "İmparatorluk Kıdemlisi" Badge
   - When a player progresses past 7 days (e.g., 45 days), the UI provides zero progression goals or milestone reward tracking.

3. **`apps/web/src/components/arcade.css`**:
   - Lines 874–948: Defines `.crash-stake-bar`, `.crash-chips-row`, `.crash-chip-btn`, and `.crash-main-btn`.
   - Automated layout & responsiveness constraints in `apps/web/src/game/arcade-stream2-challenger.test.ts`:
     - **Constraint A (Line 74–86)**:
       `/(?:^|[^-])\b(?:width|min-width)\s*:\s*(\d+)px/g`
       *No fixed width or min-width in `arcade.css` may exceed 290px.*
     - **Constraint B (Line 88–102)**:
       `/grid-template-columns\s*:\s*([^;]+);/g`
       *Every grid column definition in `arcade.css` MUST match `/repeat\(\s*\d+\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/`.*
     - **Constraint C (Line 531–558)**:
       *Interactive elements (buttons, inputs) must enforce `min-height: 44px` touch targets.*
     - **Constraint D (Line 510–529)**:
       *Grid gaps must use fluid `clamp(4px, 1.5vw, 8px)` or percentage gaps.*

4. **Existing Test Suite Assertions**:
   - `apps/web/src/screens/arcade-screen.test.tsx` (Lines 174–180):
     ```tsx
     // Chips row
     expect(markup).toContain('+50');
     expect(markup).toContain('+100');
     expect(markup).toContain('+250');
     expect(markup).toContain('+500');
     expect(markup).toContain('MAKS');
     ```
   - All 56 test files (674 total tests) across the monorepo pass cleanly when running `pnpm test`.

---

## 2. Logic Chain

### 2.1 Crypto Crash Custom Free Stake Input Architecture
1. **From Observation 1.1 & 1.4**: The user requires free custom typing of stake amounts ($10 \le \text{stake} \le \text{playerCash}$) alongside quick chips (+10, +50, +100, MAKS), while existing tests in `arcade-screen.test.tsx` explicitly assert the presence of `+50`, `+100`, `+250`, `+500`, and `MAKS`.
2. **Chip List Synthesis**: Providing quick chips `[10, 50, 100, 250, 500]` plus `MAKS` simultaneously fulfills the user requirement (+10, +50, +100, MAKS) and preserves 100% test compatibility with `arcade-screen.test.tsx` (+50, +100, +250, +500, MAKS).
3. **Input State Modeling**: In React, binding directly to an unbuffered numeric state leads to typing friction (e.g., when a player types backspace or an intermediate digit like '5' on their way to '500'). Therefore, we introduce dual-state tracking:
   - `stake`: `number` (confirmed integer value used for calculations and bet launch).
   - `rawStakeInput`: `string` (allows fluid user typing and intermediate values).
   - Real-time instant validation:
     ```ts
     const numericStake = parseInt(rawStakeInput, 10);
     const isFormatValid = !isNaN(numericStake) && /^\d+$/.test(rawStakeInput.trim());
     const isBelowMin = isFormatValid && numericStake < 10;
     const isAboveBalance = isFormatValid && playerCash > 0 && numericStake > playerCash;
     const isStakeValid = isFormatValid && !isBelowMin && !isAboveBalance;
     ```
   - On change: updates `rawStakeInput`. If `isStakeValid`, also updates `stake` immediately, updating potential payout and profit calculations in real time.
   - On blur: if empty or `numericStake < 10`, cleanly clamps to `10`; if `numericStake > playerCash` and `playerCash >= 10`, clamps to `playerCash`.
   - On chip tap: sets both `stake` and `rawStakeInput` to the chip value (clamped to player cash).
   - On MAKS tap: sets both `stake` and `rawStakeInput` to `Math.max(10, Math.min(playerCash, 100000))`.
4. **Action Gate**: The `🚀 BOĞA BAŞLAT` button is disabled when `!isStakeValid || phase === 'running' || phase === 'countdown'`, accompanied by an accessible validation feedback label (`crash-stake-validation-msg`).

### 2.2 Extended Streak Milestone Visual Track Architecture
1. **From Observation 1.2 & User Prompt R3**: Long-term streak milestones span beyond the 7-day cycle up to 365 days.
2. **Data Structure Definition**:
   ```ts
   export interface StreakMilestone {
     readonly days: number;
     readonly label: string;
     readonly period: string;
     readonly sruMultiplier: string;
     readonly cashBonus: number;
     readonly badgeName?: string;
     readonly icon: string;
     readonly description: string;
   }

   export const STREAK_MILESTONES: readonly StreakMilestone[] = [
     { days: 7, label: '7 Gün', period: '1 Hafta', sruMultiplier: '1.0x SRU', cashBonus: 500, icon: '⚡', description: '+500 Nakit · 1.0x Sezon Puanı' },
     { days: 30, label: '30 Gün', period: '1 Ay', sruMultiplier: '2.5x SRU', cashBonus: 5000, icon: '🔥', description: '+5.000 Nakit · 2.5x Sezon Puanı' },
     { days: 90, label: '90 Gün', period: '3 Ay', sruMultiplier: '5.0x SRU', cashBonus: 25000, icon: '🛡️', description: '+25.000 Nakit · 5.0x Sezon Puanı' },
     { days: 180, label: '180 Gün', period: '6 Ay', sruMultiplier: '10.0x SRU', cashBonus: 100000, icon: '💎', description: '+100.000 Nakit · 10.0x Sezon Puanı' },
     { days: 365, label: '365 Gün', period: '1 Yıl', sruMultiplier: '25.0x SRU', cashBonus: 500000, badgeName: 'İmparatorluk Kıdemlisi', icon: '👑', description: '+500.000 Nakit · 25.0x SRU · Özel Rozet' },
   ] as const;
   ```
3. **Visual Progression Track**:
   - Rendered directly inside `MissionsScreen` within an `<article className="panel missions-milestones-track">`.
   - For each milestone:
     - Status: `isAchieved` (`streak >= milestone.days`), `isCurrentTarget` (first unachieved milestone), or `isLocked`.
     - Percentage progress: `Math.min(100, Math.round((streak / milestone.days) * 100))`.
     - Status badge: `✓ AÇILDI`, `HEDEF (%X)`, or `🔒 KİLİTLİ`.
     - Reward summary pill: displays Cash bonus, SRU multiplier, and special badge reward.
     - Animated progress bar showing exact remaining days.

### 2.3 Mobile Responsiveness & `arcade.css` Conformance
1. **From Observation 1.3**: Automated checks enforce that no pixel width exceeds 290px and all grid columns use `repeat(N, minmax(0, 1fr))`.
2. **CSS Rule Invariants**:
   - Use `display: grid; grid-template-columns: repeat(1, minmax(0, 1fr));` for mobile cards, adapting to `repeat(2, minmax(0, 1fr))` on wider screens.
   - Use `display: flex; flex-wrap: wrap; gap: clamp(4px, 1.2vw, 6px);` for `.crash-chips-row` with `min-height: 44px` per button.
   - Use fluid typography with `clamp()` and zero fixed dimensions above 290px.
   - Ensure touch targets on all interactive controls (`.crash-stake-input`, `.crash-chip-btn`, `.crash-main-btn`) meet or exceed the 44px standard.

---

## 3. Caveats

1. **Anti-Exploit / Core Math Boundary**:
   - Stream 1 is responsible for `packages/game-core/src/crypto-crash.ts` and adaptive server-side/core math.
   - Stream 2 is strictly client-side UI (`crypto-crash-game.tsx`, `missions-screen.tsx`, `arcade.css`). Client-side state must gracefully adapt whether backend uses simulated or live RPC rounds.
2. **Theme Color Tokens**:
   - UI components use existing CSS variables (`--accent`, `--surface`, `--surface-raised`, `--border`, `--text`, `--muted`, `--green`, `--red`) to guarantee full dark/light theme consistency without color hardcoding.
3. **Streak Claim Mutation Hookup**:
   - The streak visual track reflects `resource.data.streak`. When `POST /streak/claim` is triggered elsewhere in the game loop, React Query invalidates the query and `MissionsScreen` updates automatically.

---

## 4. Conclusion & Concrete Implementation Blueprint

### 4.1 Target File 1: `apps/web/src/components/crypto-crash-game.tsx`

```tsx
// Proposed replacement chunk for Stake Input & Chips Bar in CryptoCrashGame

// 1. New quick chips constant and stake input state:
const QUICK_CHIPS = [10, 50, 100, 250, 500];

// Inside CryptoCrashGame:
const [stake, setStake] = useState<number>(100);
const [rawStakeInput, setRawStakeInput] = useState<string>('100');

const numericStake = parseInt(rawStakeInput, 10);
const isFormatValid = !isNaN(numericStake) && /^\d+$/.test(rawStakeInput.trim());
const isBelowMin = isFormatValid && numericStake < 10;
const isAboveBalance = isFormatValid && playerCash > 0 && numericStake > playerCash;
const isStakeValid = isFormatValid && !isBelowMin && !isAboveBalance;

function handleStakeInputChange(val: string) {
  const digitsOnly = val.replace(/\D/g, '');
  setRawStakeInput(digitsOnly);
  const parsed = parseInt(digitsOnly, 10);
  if (!isNaN(parsed)) {
    setStake(parsed);
  }
}

function handleStakeBlur() {
  if (!rawStakeInput || isNaN(numericStake) || numericStake < 10) {
    setStake(10);
    setRawStakeInput('10');
  } else if (playerCash > 0 && numericStake > playerCash) {
    const clamped = Math.max(10, playerCash);
    setStake(clamped);
    setRawStakeInput(String(clamped));
  }
}

function handleSelectChip(chip: number) {
  const target = playerCash > 0 ? Math.min(chip, playerCash) : chip;
  setStake(target);
  setRawStakeInput(String(target));
  playTapSound();
}

function handleMaxStake() {
  const maxAvailable = playerCash > 0 ? Math.max(10, Math.min(playerCash, 100000)) : 5000;
  setStake(maxAvailable);
  setRawStakeInput(String(maxAvailable));
  playTapSound();
}

// 2. Updated JSX Stake Bar:
<div className="crash-stake-bar">
  <div className="crash-stake-top-row">
    <span className="crash-stake-label">Yatırım Tutarı</span>
    <span className="crash-stake-balance">
      Bakiye: <strong>{playerCash} Nakit</strong>
    </span>
  </div>

  <div className="crash-stake-input-group">
    <div className={`crash-stake-input-wrapper ${!isStakeValid ? 'has-error' : ''}`}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="crash-stake-input"
        value={rawStakeInput}
        onChange={(e) => handleStakeInputChange(e.target.value)}
        onBlur={handleStakeBlur}
        disabled={phase === 'running' || phase === 'countdown'}
        aria-label="Yatırım Tutarı"
        placeholder="Min 10"
      />
      <span className="crash-stake-currency">NAKİT</span>
    </div>
  </div>

  {/* Real-time Validation Error / Hint */}
  {!isStakeValid && (
    <div className="crash-stake-validation-msg" role="alert">
      {isBelowMin
        ? 'Minimum yatırım 10 Nakit olmalıdır.'
        : isAboveBalance
          ? `Yetersiz bakiye! Maksimum: ${playerCash} Nakit`
          : 'Lütfen geçerli bir tutar girin.'}
    </div>
  )}

  {/* Quick Chips Row */}
  <div className="crash-chips-row">
    {QUICK_CHIPS.map((chip) => (
      <button
        key={chip}
        type="button"
        className={`crash-chip-btn ${stake === chip ? 'active' : ''}`}
        onClick={() => handleSelectChip(chip)}
        disabled={phase === 'running' || phase === 'countdown'}
      >
        +{chip}
      </button>
    ))}
    <button
      type="button"
      className="crash-chip-btn"
      onClick={handleMaxStake}
      disabled={phase === 'running' || phase === 'countdown'}
    >
      MAKS
    </button>
  </div>
</div>
```

---

### 4.2 Target File 2: `apps/web/src/screens/missions-screen.tsx`

```tsx
// Proposed additions for Extended Streak Milestones in MissionsScreen

export interface StreakMilestone {
  readonly days: number;
  readonly label: string;
  readonly period: string;
  readonly sruMultiplier: string;
  readonly cashBonus: number;
  readonly badgeName?: string;
  readonly icon: string;
  readonly description: string;
}

export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  { days: 7, label: '7 Gün', period: '1 Hafta', sruMultiplier: '1.0x SRU', cashBonus: 500, icon: '⚡', description: '+500 Nakit · 1.0x Sezon Puanı' },
  { days: 30, label: '30 Gün', period: '1 Ay', sruMultiplier: '2.5x SRU', cashBonus: 5000, icon: '🔥', description: '+5.000 Nakit · 2.5x Sezon Puanı' },
  { days: 90, label: '90 Gün', period: '3 Ay', sruMultiplier: '5.0x SRU', cashBonus: 25000, icon: '🛡️', description: '+25.000 Nakit · 5.0x Sezon Puanı' },
  { days: 180, label: '180 Gün', period: '6 Ay', sruMultiplier: '10.0x SRU', cashBonus: 100000, icon: '💎', description: '+100.000 Nakit · 10.0x Sezon Puanı' },
  { days: 365, label: '365 Gün', period: '1 Yıl', sruMultiplier: '25.0x SRU', cashBonus: 500000, badgeName: 'İmparatorluk Kıdemlisi', icon: '👑', description: '+500.000 Nakit · 25.0x SRU · Özel Rozet' },
] as const;

// Inside MissionsScreen JSX (immediately below the missions-streak article):
<article className="panel missions-milestones-track">
  <div className="missions-milestones-header">
    <div>
      <p className="eyebrow">KIDEM KİLOMETRE TAŞLARI</p>
      <h2>Uzun Vadeli Seri Hedefleri</h2>
    </div>
    <span className="missions-milestones-sub">
      Mevcut: <strong>{streak} gün</strong>
    </span>
  </div>

  <div className="missions-milestones-grid" role="list" aria-label="Seri Kilometre Taşları">
    {STREAK_MILESTONES.map((milestone, idx) => {
      const isAchieved = streak >= milestone.days;
      const prevAchieved = idx === 0 || streak >= STREAK_MILESTONES[idx - 1]!.days;
      const isCurrentTarget = !isAchieved && prevAchieved;
      const progressPct = Math.min(100, Math.round((streak / milestone.days) * 100));

      return (
        <div
          key={milestone.days}
          role="listitem"
          className={`milestone-card ${isAchieved ? 'is-achieved' : isCurrentTarget ? 'is-target' : 'is-locked'}`}
        >
          <div className="milestone-card-top">
            <div className="milestone-title-group">
              <span className="milestone-icon" aria-hidden="true">{milestone.icon}</span>
              <div>
                <strong>{milestone.label} ({milestone.period})</strong>
                {milestone.badgeName && (
                  <span className="milestone-badge-tag">{milestone.badgeName}</span>
                )}
              </div>
            </div>
            <span className={`milestone-status-pill ${isAchieved ? 'achieved' : isCurrentTarget ? 'target' : 'locked'}`}>
              {isAchieved ? '✓ AÇILDI' : isCurrentTarget ? `%${progressPct}` : '🔒 KİLİTLİ'}
            </span>
          </div>

          <p className="milestone-rewards-copy">{milestone.description}</p>

          <div className="milestone-progress-track" aria-hidden="true">
            <div
              className="milestone-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="milestone-footer-info">
            <small>
              {isAchieved
                ? 'Ödül hakkı tamamlandı'
                : `${Math.max(0, milestone.days - streak)} gün kaldı`}
            </small>
            <small>{streak} / {milestone.days} gün</small>
          </div>
        </div>
      );
    })}
  </div>
</article>
```

---

### 4.3 Target File 3: `apps/web/src/components/arcade.css`

```css
/* ============================================================
   CRYPTO CRASH CUSTOM STAKE INPUT & VALIDATION STYLING
   ============================================================ */
.crash-stake-top-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8rem;
}

.crash-stake-label {
  color: var(--muted, #a8b0bf);
}

.crash-stake-balance {
  color: var(--text, #f4f0e8);
  font-size: 0.78rem;
}

.crash-stake-balance strong {
  color: var(--accent, #e1b47e);
}

.crash-stake-input-group {
  width: 100%;
}

.crash-stake-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--surface-raised, #202736);
  border: 1px solid rgba(150, 160, 180, 0.2);
  border-radius: 12px;
  padding: 2px 12px;
  min-height: 44px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.crash-stake-input-wrapper:focus-within {
  border-color: var(--accent, #e1b47e);
  box-shadow: 0 0 8px rgba(225, 180, 126, 0.25);
}

.crash-stake-input-wrapper.has-error {
  border-color: var(--red, #ff9e9e);
  box-shadow: 0 0 8px rgba(255, 158, 158, 0.25);
}

.crash-stake-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text, #f4f0e8);
  font-size: 1.05rem;
  font-weight: 700;
  min-height: 44px;
  font-family: inherit;
  width: 100%;
}

.crash-stake-currency {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--accent, #e1b47e);
  letter-spacing: 1px;
}

.crash-stake-validation-msg {
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--red, #ff9e9e);
  padding: 2px 4px;
}

/* Chips Row Layout with Mobile Flex-Wrap */
.crash-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(4px, 1.2vw, 6px);
  width: 100%;
}

.crash-chip-btn {
  flex: 1 1 calc(16.6% - 6px);
  min-width: 44px;
  min-height: 44px;
  background: var(--surface-raised, #202736);
  border: 1px solid rgba(150, 160, 180, 0.2);
  color: var(--text, #f4f0e8);
  border-radius: 10px;
  padding: 6px 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.crash-chip-btn.active {
  background: rgba(225, 180, 126, 0.2);
  border-color: var(--accent, #e1b47e);
  color: var(--accent, #e1b47e);
}

/* ============================================================
   EXTENDED STREAK MILESTONE VISUAL TRACK STYLING
   ============================================================ */
.missions-milestones-track {
  margin-top: 16px;
  padding: clamp(16px, 4vw, 24px);
  background: var(--surface-raised, #202736);
  border: 1px solid var(--border, rgba(150, 160, 180, 0.18));
  border-radius: var(--radius, 20px);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.missions-milestones-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}

.missions-milestones-header h2 {
  margin: 4px 0 0;
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}

.missions-milestones-sub {
  font-size: 0.8rem;
  color: var(--muted, #a8b0bf);
}

.missions-milestones-sub strong {
  color: var(--accent, #e1b47e);
}

/* Conforms strictly to /repeat\(\s*\d+\s*,\s*minmax\(\s*0\s*,\s*1fr\s*\)\s*\)/ */
.missions-milestones-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: clamp(8px, 1.8vw, 12px);
  width: 100%;
}

.milestone-card {
  background: var(--surface, #181e29);
  border: 1px solid var(--border, rgba(150, 160, 180, 0.15));
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.milestone-card.is-achieved {
  border-color: rgba(126, 210, 173, 0.4);
  background: linear-gradient(135deg, rgba(126, 210, 173, 0.06), var(--surface, #181e29));
}

.milestone-card.is-target {
  border-color: rgba(225, 180, 126, 0.5);
  box-shadow: 0 0 10px rgba(225, 180, 126, 0.15);
}

.milestone-card.is-locked {
  opacity: 0.7;
}

.milestone-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.milestone-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.milestone-icon {
  font-size: 1.25rem;
}

.milestone-title-group strong {
  font-size: 0.9rem;
  color: var(--text, #f4f0e8);
}

.milestone-badge-tag {
  display: block;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--accent, #e1b47e);
}

.milestone-status-pill {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.milestone-status-pill.achieved {
  background: rgba(126, 210, 173, 0.15);
  color: var(--green, #7ed2ad);
  border: 1px solid rgba(126, 210, 173, 0.3);
}

.milestone-status-pill.target {
  background: rgba(225, 180, 126, 0.2);
  color: var(--accent, #e1b47e);
  border: 1px solid var(--accent, #e1b47e);
}

.milestone-status-pill.locked {
  background: rgba(150, 160, 180, 0.1);
  color: var(--muted, #a8b0bf);
  border: 1px solid rgba(150, 160, 180, 0.15);
}

.milestone-rewards-copy {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted, #a8b0bf);
  line-height: 1.4;
}

.milestone-progress-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.milestone-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--green, #7ed2ad), var(--accent, #e1b47e));
  transition: width 0.3s ease;
}

.milestone-footer-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--muted, #a8b0bf);
}

/* Responsive adjustment for 320px screens */
@media (max-width: 359px) {
  .crash-chip-btn {
    flex: 1 1 calc(33.33% - 4px);
    font-size: 0.7rem;
  }

  .missions-milestones-track {
    padding: 12px;
  }

  .milestone-card {
    padding: 10px;
  }
}
```

---

## 5. Verification Method

### 5.1 Automated Command-Line Verification
1. **Full Test Suite Run**:
   ```bash
   pnpm test
   ```
   *Expected Result*: All 56 test files (674+ tests) pass with 0 failures, including `arcade-screen.test.tsx` and `arcade-stream2-challenger.test.ts`.
2. **Challenger Invariant Audit**:
   ```bash
   pnpm vitest run apps/web/src/game/arcade-stream2-challenger.test.ts
   ```
   *Expected Result*: Passes all probes:
   - Zero fixed widths > 290px in `arcade.css`.
   - All `grid-template-columns` match `repeat(N, minmax(0, 1fr))`.
   - All touch targets $\ge 44\text{px}$.
3. **Screen Rendering & Prop Integrity**:
   ```bash
   pnpm vitest run apps/web/src/screens/arcade-screen.test.tsx apps/web/src/game/live-game-screens.test.tsx
   ```
   *Expected Result*: Clean execution confirming all chip buttons (+50, +100, +250, +500, MAKS), input markup, and Missions screen cards render without error.
4. **Full Workspace Quality Gate**:
   ```bash
   pnpm check
   ```
   *Expected Result*: ESLint, Prettier check, TypeScript typecheck across all packages, Vitest test suite, and Vite build all exit with code 0.

### 5.2 Visual & Manual Inspection Checklist
1. Inspect `CryptoCrashGame`:
   - Typing "25" sets the stake to 25 and updates potential payout immediately.
   - Typing "5" triggers immediate warning "Minimum yatırım 10 Nakit olmalıdır." and disables launch button.
   - Typing an amount greater than `playerCash` shows "Yetersiz bakiye!" warning.
   - Clicking quick chips (+10, +50, +100, +250, +500, MAKS) updates input box and confirmed stake synchronously.
2. Inspect `MissionsScreen`:
   - With `streak: 1`: 7-day milestone shows progress `1/7 (%14)`, later milestones show locked status with correct remaining day counts.
   - With `streak: 35`: 7-day and 30-day milestones show `✓ AÇILDI`, 90-day milestone is marked as `is-target` with `35/90 (%39)` progress.
   - Viewport resized to 320px width: zero horizontal scrollbar appears anywhere on the screen.

### 5.3 Invalidation Conditions
- Any declaration in `arcade.css` with a fixed pixel width greater than 290px invalidates the Challenger Test Vector 1.
- Any `grid-template-columns` in `arcade.css` not using `repeat(N, minmax(0, 1fr))` invalidates Challenger Test Vector 1.
- Omitting `+50`, `+100`, `+250`, `+500`, or `MAKS` invalidates `arcade-screen.test.tsx`.
