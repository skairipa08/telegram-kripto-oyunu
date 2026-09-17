import { describe, expect, it } from 'vitest';
import {
  calculatePredictionOdds,
  calculatePredictionPayout,
  createPredictionBetTicket,
  INITIAL_PREDICTION_MARKETS,
  MIN_PREDICTION_STAKE,
  resolvePredictionBetTicket,
  validatePredictionStake,
  type PredictionMarket,
} from './crypto-predictions-model';

describe('Crypto Predictions Domain Model & Pure Helpers', () => {
  describe('calculatePredictionPayout', () => {
    it('calculates expected payout with integer truncation', () => {
      expect(calculatePredictionPayout(100, 1.85)).toBe(185);
      expect(calculatePredictionPayout(500, 1.95)).toBe(975);
      expect(calculatePredictionPayout(1000, 2.1)).toBe(2100);
      expect(calculatePredictionPayout(333, 1.85)).toBe(Math.floor(333 * 1.85)); // 616
    });

    it('rounds down fractional payouts (Math.floor)', () => {
      expect(calculatePredictionPayout(100, 1.859)).toBe(185);
      expect(calculatePredictionPayout(75, 1.333333)).toBe(99);
    });

    it('returns 0 for zero or negative stake or odds', () => {
      expect(calculatePredictionPayout(0, 1.85)).toBe(0);
      expect(calculatePredictionPayout(-50, 1.85)).toBe(0);
      expect(calculatePredictionPayout(100, 0)).toBe(0);
      expect(calculatePredictionPayout(100, -1.5)).toBe(0);
    });
  });

  describe('validatePredictionStake', () => {
    it('accepts valid stakes equal to or above 50 within user balance', () => {
      expect(validatePredictionStake(50, 50)).toEqual({ valid: true });
      expect(validatePredictionStake(500, 1000)).toEqual({ valid: true });
      expect(validatePredictionStake(10000, 10000)).toEqual({ valid: true });
    });

    it('rejects stakes below the minimum stake of 50', () => {
      const res = validatePredictionStake(49, 1000);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('50');

      const resZero = validatePredictionStake(1, 1000);
      expect(resZero.valid).toBe(false);
    });

    it('rejects stakes exceeding the user balance', () => {
      const res = validatePredictionStake(500, 499);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Yetersiz bakiye');

      const resTight = validatePredictionStake(50, 40);
      expect(resTight.valid).toBe(false);
      expect(resTight.error).toContain('Yetersiz bakiye');
    });

    it('rejects non-integer, negative, or invalid stakes', () => {
      expect(validatePredictionStake(0, 1000).valid).toBe(false);
      expect(validatePredictionStake(-100, 1000).valid).toBe(false);
      expect(validatePredictionStake(50.5, 1000).valid).toBe(false);
      expect(validatePredictionStake(NaN, 1000).valid).toBe(false);
      expect(validatePredictionStake(Infinity, 1000).valid).toBe(false);
    });

    it('exposes MIN_PREDICTION_STAKE constant as 50', () => {
      expect(MIN_PREDICTION_STAKE).toBe(50);
    });
  });

  describe('calculatePredictionOdds', () => {
    const mockMarket: PredictionMarket = {
      id: 'test_market',
      category: 'crypto',
      categoryLabel: 'Crypto',
      categoryIcon: '🪙',
      title: 'Test Market Title',
      description: 'Test Market Description',
      endDate: 'Tomorrow',
      totalPoolCash: 100000,
      yesOdds: 1.85,
      noOdds: 1.95,
      yesVotesPercent: 55,
    };

    it('returns yesOdds when choice is "yes"', () => {
      expect(calculatePredictionOdds(mockMarket, 'yes')).toBe(1.85);
    });

    it('returns noOdds when choice is "no"', () => {
      expect(calculatePredictionOdds(mockMarket, 'no')).toBe(1.95);
    });

    it('works across predefined market catalog items', () => {
      const btcMarket = INITIAL_PREDICTION_MARKETS.find(
        (m) => m.id === 'pred_btc_80k',
      )!;
      expect(calculatePredictionOdds(btcMarket, 'yes')).toBe(btcMarket.yesOdds);
      expect(calculatePredictionOdds(btcMarket, 'no')).toBe(btcMarket.noOdds);
    });
  });

  describe('createPredictionBetTicket', () => {
    it('creates an active ticket with correct calculated payout and Turkish labels', () => {
      const ticket = createPredictionBetTicket({
        marketId: 'pred_btc_80k',
        choice: 'yes',
        stake: 500,
        odds: 1.85,
      });

      expect(ticket.id).toBeDefined();
      expect(typeof ticket.id).toBe('string');
      expect(ticket.id.length).toBeGreaterThan(0);
      expect(ticket.marketId).toBe('pred_btc_80k');
      expect(ticket.marketTitle).toContain('Bitcoin');
      expect(ticket.choice).toBe('yes');
      expect(ticket.choiceLabel).toBe('EVET (Üstü / Olur)');
      expect(ticket.stake).toBe(500);
      expect(ticket.odds).toBe(1.85);
      expect(ticket.potentialPayout).toBe(925);
      expect(ticket.status).toBe('active');
      expect(ticket.claimed).toBe(false);
      expect(ticket.placedAt).toBeDefined();
    });

    it('sets correct label for "no" choice', () => {
      const ticket = createPredictionBetTicket({
        marketId: 'pred_eth_gas',
        choice: 'no',
        stake: 200,
        odds: 1.7,
      });

      expect(ticket.choice).toBe('no');
      expect(ticket.choiceLabel).toBe('HAYIR (Altı / Olmaz)');
      expect(ticket.potentialPayout).toBe(340);
    });

    it('allows custom id, marketTitle, and placedAt overrides', () => {
      const customTicket = createPredictionBetTicket({
        id: 'custom-ticket-123',
        marketId: 'custom-market',
        marketTitle: 'Custom Event',
        choice: 'yes',
        stake: 100,
        odds: 2.5,
        placedAt: '12:34',
      });

      expect(customTicket.id).toBe('custom-ticket-123');
      expect(customTicket.marketTitle).toBe('Custom Event');
      expect(customTicket.placedAt).toBe('12:34');
    });
  });

  describe('resolvePredictionBetTicket', () => {
    it('resolves winning bet: won=true, awards payout, positive netProfit', () => {
      const ticket = createPredictionBetTicket({
        marketId: 'pred_btc_80k',
        choice: 'yes',
        stake: 500,
        odds: 1.85,
      });

      const resolution = resolvePredictionBetTicket(ticket, 'yes');
      expect(resolution.won).toBe(true);
      expect(resolution.payoutCash).toBe(925);
      expect(resolution.netProfit).toBe(425); // 925 - 500
    });

    it('resolves losing bet: won=false, payout=0, negative netProfit equals -stake', () => {
      const ticket = createPredictionBetTicket({
        marketId: 'pred_btc_80k',
        choice: 'yes',
        stake: 500,
        odds: 1.85,
      });

      const resolution = resolvePredictionBetTicket(ticket, 'no');
      expect(resolution.won).toBe(false);
      expect(resolution.payoutCash).toBe(0);
      expect(resolution.netProfit).toBe(-500); // 0 - 500
    });

    it('correctly resolves "no" choice wins and losses', () => {
      const ticket = createPredictionBetTicket({
        marketId: 'pred_gold_record',
        choice: 'no',
        stake: 1000,
        odds: 1.7,
      });

      const winRes = resolvePredictionBetTicket(ticket, 'no');
      expect(winRes.won).toBe(true);
      expect(winRes.payoutCash).toBe(1700);
      expect(winRes.netProfit).toBe(700);

      const lossRes = resolvePredictionBetTicket(ticket, 'yes');
      expect(lossRes.won).toBe(false);
      expect(lossRes.payoutCash).toBe(0);
      expect(lossRes.netProfit).toBe(-1000);
    });
  });

  describe('INITIAL_PREDICTION_MARKETS Integrity & Bookmaker Margin', () => {
    it('contains all 7 initial prediction markets with valid properties', () => {
      expect(INITIAL_PREDICTION_MARKETS.length).toBe(7);

      for (const market of INITIAL_PREDICTION_MARKETS) {
        expect(market.id).toBeDefined();
        expect(market.title.length).toBeGreaterThan(5);
        expect(market.totalPoolCash).toBeGreaterThan(0);
        expect(market.yesOdds).toBeGreaterThan(1.0);
        expect(market.noOdds).toBeGreaterThan(1.0);
        expect(market.yesVotesPercent).toBeGreaterThanOrEqual(0);
        expect(market.yesVotesPercent).toBeLessThanOrEqual(100);

        // Bookmaker margin verification: total implied probability should exceed 1.0 (overround)
        const impliedProb = 1 / market.yesOdds + 1 / market.noOdds;
        expect(impliedProb).toBeGreaterThan(1.0); // Bookmaker has house margin
        expect(impliedProb).toBeLessThan(1.15); // Margin is reasonable (under 15%)
      }
    });
  });
});
