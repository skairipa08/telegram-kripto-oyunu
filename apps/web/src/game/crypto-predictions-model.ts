// apps/web/src/game/crypto-predictions-model.ts
// Domain model for Market Predictions & Betting minigame

export type PredictionCategory = 'all' | 'crypto' | 'tech' | 'sports' | 'world';

export interface PredictionMarket {
  id: string;
  category: 'crypto' | 'tech' | 'sports' | 'world';
  categoryLabel: string;
  categoryIcon: string;
  title: string;
  description: string;
  endDate: string;
  totalPoolCash: number;
  yesOdds: number; // e.g. 1.85
  noOdds: number; // e.g. 1.95
  yesVotesPercent: number; // e.g. 62%
  resolvedOutcome?: 'yes' | 'no';
}

export interface PredictionBetTicket {
  id: string;
  marketId: string;
  marketTitle: string;
  choice: 'yes' | 'no';
  choiceLabel: string;
  stake: number;
  odds: number;
  potentialPayout: number;
  placedAt: string;
  status: 'active' | 'won' | 'lost';
  claimed: boolean;
}

export const INITIAL_PREDICTION_MARKETS: readonly PredictionMarket[] = [
  {
    id: 'pred_btc_80k',
    category: 'crypto',
    categoryLabel: 'Kripto Para',
    categoryIcon: '🪙',
    title: 'Bitcoin (BTC) bu hafta $80.000 üstünde kapatır mı?',
    description:
      'Pazar gecesi UTC 00:00 itibarıyla Binance spot fiyatı baz alınır.',
    endDate: 'Bu Pazar 23:59',
    totalPoolCash: 1250000,
    yesOdds: 1.85,
    noOdds: 1.95,
    yesVotesPercent: 64,
  },
  {
    id: 'pred_eth_gas',
    category: 'crypto',
    categoryLabel: 'Kripto Para',
    categoryIcon: '🪙',
    title: 'Ethereum işlem ücretleri bu hafta 15 Gwei altına iner mi?',
    description: 'Etherscan 7 günlük medyan gas ücreti verisi esas alınır.',
    endDate: 'Bu Cuma 18:00',
    totalPoolCash: 850000,
    yesOdds: 2.1,
    noOdds: 1.7,
    yesVotesPercent: 42,
  },
  {
    id: 'pred_ton_ath',
    category: 'crypto',
    categoryLabel: 'Kripto Para',
    categoryIcon: '🪙',
    title: 'Telegram TON Coin bu ay $8.50 rekorunu aşar mı?',
    description: 'CoinGecko anlık en yüksek fiyat listelemesi referans alınır.',
    endDate: 'Ay Sonu',
    totalPoolCash: 2100000,
    yesOdds: 1.9,
    noOdds: 1.9,
    yesVotesPercent: 55,
  },
  {
    id: 'pred_ai_turing',
    category: 'tech',
    categoryLabel: 'Yapay Zeka',
    categoryIcon: '🤖',
    title: 'Yeni nesil Yapay Zeka modeli bu çeyrek Turing Testini geçer mi?',
    description:
      'Bağımsız akademik konsorsiyum çift-kör test sonuçları baz alınır.',
    endDate: '15 Gün İçinde',
    totalPoolCash: 1750000,
    yesOdds: 2.25,
    noOdds: 1.65,
    yesVotesPercent: 38,
  },
  {
    id: 'pred_spacex_launch',
    category: 'tech',
    categoryLabel: 'Teknoloji',
    categoryIcon: '🚀',
    title: 'SpaceX Starship yörünge fırlatmasını kayıpsız tamamlar mı?',
    description: 'FAA ve SpaceX resmi uçuş raporu esas kabul edilir.',
    endDate: 'Haftaya Salı',
    totalPoolCash: 980000,
    yesOdds: 1.75,
    noOdds: 2.05,
    yesVotesPercent: 71,
  },
  {
    id: 'pred_gold_record',
    category: 'world',
    categoryLabel: 'Genel Ekonomi',
    categoryIcon: '🌍',
    title: 'Altın ONS fiyatı bu ay $2.800 tarihi zirvesini görür mü?',
    description: 'COMEX vadeli altın kontratı anlık tepe noktası baz alınır.',
    endDate: '30 Gün',
    totalPoolCash: 3400000,
    yesOdds: 2.15,
    noOdds: 1.7,
    yesVotesPercent: 49,
  },
  {
    id: 'pred_champions_ucl',
    category: 'sports',
    categoryLabel: 'Spor & Futbol',
    categoryIcon: '⚽',
    title: 'Şampiyonlar Ligi bu hafta Real Madrid maçında 2.5 üst gol olur mu?',
    description: 'UEFA resmi maç skoru 90 dakika sonucu geçerlidir.',
    endDate: 'Çarşamba 22:00',
    totalPoolCash: 1420000,
    yesOdds: 1.85,
    noOdds: 1.95,
    yesVotesPercent: 58,
  },
];

export const MIN_PREDICTION_STAKE = 50;

/**
 * Calculates potential payout from stake and odds, rounded down to nearest integer.
 */
export function calculatePredictionPayout(stake: number, odds: number): number {
  if (stake <= 0 || odds <= 0) return 0;
  return Math.floor(stake * odds);
}

/**
 * Validates prediction bet stake:
 * - Must be a positive integer
 * - Must be at least MIN_PREDICTION_STAKE (50)
 * - Must not exceed user balance
 */
export function validatePredictionStake(
  stake: number,
  userBalance: number,
): { valid: boolean; error?: string } {
  if (!Number.isFinite(stake) || !Number.isInteger(stake) || stake <= 0) {
    return {
      valid: false,
      error: 'Bahis tutarı geçerli bir pozitif tam sayı olmalıdır.',
    };
  }
  if (stake < MIN_PREDICTION_STAKE) {
    return {
      valid: false,
      error: `Minimum tahmin tutarı ${MIN_PREDICTION_STAKE} Nakittir.`,
    };
  }
  if (stake > userBalance) {
    return { valid: false, error: 'Yetersiz bakiye!' };
  }
  return { valid: true };
}

/**
 * Retrieves the odds for a chosen outcome ('yes' or 'no') from a prediction market.
 */
export function calculatePredictionOdds(
  market: PredictionMarket,
  choice: 'yes' | 'no',
): number {
  return choice === 'yes' ? market.yesOdds : market.noOdds;
}

export interface CreatePredictionBetTicketParams {
  marketId: string;
  choice: 'yes' | 'no';
  stake: number;
  odds: number;
  marketTitle?: string;
  id?: string;
  placedAt?: string;
}

/**
 * Creates a new active prediction bet ticket.
 */
export function createPredictionBetTicket(
  params: CreatePredictionBetTicketParams,
): PredictionBetTicket {
  const market = INITIAL_PREDICTION_MARKETS.find(
    (m) => m.id === params.marketId,
  );
  const marketTitle = params.marketTitle ?? market?.title ?? params.marketId;
  const choiceLabel =
    params.choice === 'yes' ? 'EVET (Üstü / Olur)' : 'HAYIR (Altı / Olmaz)';
  const id =
    params.id ??
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const potentialPayout = calculatePredictionPayout(params.stake, params.odds);
  const placedAt =
    params.placedAt ??
    new Date().toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  return {
    id,
    marketId: params.marketId,
    marketTitle,
    choice: params.choice,
    choiceLabel,
    stake: params.stake,
    odds: params.odds,
    potentialPayout,
    placedAt,
    status: 'active',
    claimed: false,
  };
}

/**
 * Resolves a bet ticket based on the market outcome ('yes' | 'no').
 * Returns whether won, total payout cash, and net profit.
 */
export function resolvePredictionBetTicket(
  ticket: PredictionBetTicket,
  outcome: 'yes' | 'no',
): { won: boolean; payoutCash: number; netProfit: number } {
  const won = ticket.choice === outcome;
  const payoutCash = won ? ticket.potentialPayout : 0;
  const netProfit = payoutCash - ticket.stake;
  return { won, payoutCash, netProfit };
}
