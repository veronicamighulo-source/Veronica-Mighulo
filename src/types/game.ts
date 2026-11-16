export type PrizeType = 'JACKPOT' | 'CASH_KSH' | 'BONUS_SPIN' | 'TRY_AGAIN';

export interface PrizeSegment {
  id: string;
  label: string;
  type: PrizeType;
  value: number; // KSh / points value (or bonus spins count for BONUS_SPIN)
  weight: number; // Relative probability weight (>= 0)
  color: string;
  textColor: string;
  enabled: boolean;
}

export interface GameSettings {
  spinCostPoints: number;
  welcomePoints: number;
  welcomeFreeSpins: number;
  jackpotTitle: string;
  dailyBonusPoints: number;
  dailyBonusSpins: number;
  dailyBonusEnabled: boolean;
  soundEnabledByDefault: boolean;
  adminPasscode: string;
}

export interface PublicGameSettings {
  spinCostPoints: number;
  welcomePoints: number;
  welcomeFreeSpins: number;
  jackpotTitle: string;
  dailyBonusPoints: number;
  dailyBonusSpins: number;
  dailyBonusEnabled: boolean;
  soundEnabledByDefault: boolean;
}

export interface FairnessProof {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  proofHash: string;
  roll: number;
  totalWeight: number;
  activeWeightsSnapshot: Array<{ id: string; label: string; weight: number }>;
}

export interface SpinRecord {
  id: string;
  playerId: string;
  playerName: string;
  maskedPhone: string;
  prizeId: string;
  prizeLabel: string;
  prizeType: PrizeType;
  prizeValue: number;
  costPoints: number;
  usedFreeSpin: boolean;
  netPointsDelta: number;
  createdAt: string;
  fairness: FairnessProof;
  isDemo?: boolean;
}

export interface RedemptionRecord {
  id: string;
  playerId: string;
  amountKsh: number;
  phone: string;
  status: 'COMPLETED' | 'PENDING';
  createdAt: string;
}

export interface PublicPlayer {
  id: string;
  name: string;
  phone: string;
  linkedWalletPhone?: string;
  maskedPhone: string;
  points: number;
  freeSpins: number;
  totalSpins: number;
  totalWonKsh: number;
  lastDailyClaimAt: string | null;
  createdAt: string;
}

export interface PublicWinnerFeedItem {
  id: string;
  playerName: string;
  maskedPhone: string;
  prizeLabel: string;
  prizeType: PrizeType;
  prizeValue: number;
  createdAt: string;
}

export interface AdminOverviewResponse {
  prizes: PrizeSegment[];
  settings: GameSettings;
  players: PublicPlayer[];
  recentSpins: SpinRecord[];
  redemptions: RedemptionRecord[];
  stats: {
    totalPlayers: number;
    totalSpins: number;
    totalAwardedKsh: number;
    jackpotHits: number;
  };
}

export type RiskLevel = 'Low' | 'Balanced' | 'High Yield';

export interface InvestPlan {
  id: string;
  name: string;
  termDays: number;
  returnPercent: number;
  minAmount: number;
  maxAmount: number;
  bonusFreeSpins: number;
  riskLevel: RiskLevel;
  description: string;
}

export interface InvestmentPosition {
  id: string;
  playerId: string;
  planId: string;
  planName: string;
  principal: number;
  returnPercent: number;
  termDays: number;
  bonusFreeSpinsAwarded: number;
  status: 'ACTIVE' | 'CLAIMED';
  createdAt: string;
  maturesAt: string;
  claimedAt: string | null;
  payoutAmount: number;
  accruedYield?: number;
}

export interface InvestPortfolioResponse {
  plans: InvestPlan[];
  positions: InvestmentPosition[];
  totals: {
    totalPrincipal: number;
    currentValue: number;
    accruedYield: number;
    activeCount: number;
  };
}

export type PaymentChannel = 'MPESA_SAFARICOM' | 'BANK_TRANSFER';
export type WalletTxType = 'DEPOSIT' | 'WITHDRAW';
export type WalletTxStatus = 'COMPLETED' | 'PENDING' | 'FAILED';

export interface WalletTransaction {
  id: string;
  playerId: string;
  type: WalletTxType;
  channel: PaymentChannel;
  amountKsh: number;
  phoneOrAccount: string;
  bankName?: string;
  accountName?: string;
  referenceCode: string;
  checkoutRequestId?: string;
  mode: 'DARAJA_LIVE' | 'SANDBOX';
  status: WalletTxStatus;
  createdAt: string;
}

export interface WalletOverviewResponse {
  mpesaMode: 'DARAJA_LIVE' | 'SANDBOX';
  banks: string[];
  transactions: WalletTransaction[];
}


