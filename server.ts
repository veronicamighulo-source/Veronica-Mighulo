import crypto from 'crypto';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  FairnessProof,
  GameSettings,
  InvestmentPosition,
  InvestPlan,
  PaymentChannel,
  PrizeSegment,
  PublicGameSettings,
  PublicPlayer,
  PublicWinnerFeedItem,
  RedemptionRecord,
  SpinRecord,
  WalletTransaction,
} from './src/types/game.ts';

interface StoredPlayer {
  id: string;
  name: string;
  phone: string;
  linkedWalletPhone?: string;
  pinHash: string;
  points: number;
  freeSpins: number;
  totalSpins: number;
  totalWonKsh: number;
  lastDailyClaimAt: string | null;
  createdAt: string;
}

interface DatabaseSchema {
  prizes: PrizeSegment[];
  settings: GameSettings;
  players: StoredPlayer[];
  spins: SpinRecord[];
  redemptions: RedemptionRecord[];
  investments: InvestmentPosition[];
  walletTransactions: WalletTransaction[];
  sessionSecret: string;
  nonceCounter: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'gambolin-db.json');

const DEFAULT_PRIZES: PrizeSegment[] = [
  {
    id: 'prize-jackpot',
    label: 'Jackpot',
    type: 'JACKPOT',
    value: 5000,
    weight: 1,
    color: '#D97706',
    textColor: '#FFFBEB',
    enabled: true,
  },
  {
    id: 'prize-ksh-10',
    label: 'KSh 10',
    type: 'CASH_KSH',
    value: 10,
    weight: 26,
    color: '#047857',
    textColor: '#ECFDF5',
    enabled: true,
  },
  {
    id: 'prize-try-again-1',
    label: 'Try Again',
    type: 'TRY_AGAIN',
    value: 0,
    weight: 22,
    color: '#1E293B',
    textColor: '#CBD5E1',
    enabled: true,
  },
  {
    id: 'prize-ksh-50',
    label: 'KSh 50',
    type: 'CASH_KSH',
    value: 50,
    weight: 15,
    color: '#0F766E',
    textColor: '#F0FDFA',
    enabled: true,
  },
  {
    id: 'prize-bonus-spin',
    label: 'Bonus Spin',
    type: 'BONUS_SPIN',
    value: 1,
    weight: 10,
    color: '#7C3AED',
    textColor: '#F5F3FF',
    enabled: true,
  },
  {
    id: 'prize-ksh-100',
    label: 'KSh 100',
    type: 'CASH_KSH',
    value: 100,
    weight: 8,
    color: '#2563EB',
    textColor: '#EFF6FF',
    enabled: true,
  },
  {
    id: 'prize-try-again-2',
    label: 'Try Again',
    type: 'TRY_AGAIN',
    value: 0,
    weight: 13,
    color: '#334155',
    textColor: '#E2E8F0',
    enabled: true,
  },
  {
    id: 'prize-ksh-500',
    label: 'KSh 500',
    type: 'CASH_KSH',
    value: 500,
    weight: 5,
    color: '#DC2626',
    textColor: '#FEF2F2',
    enabled: true,
  },
];

const DEFAULT_SETTINGS: GameSettings = {
  spinCostPoints: 50,
  welcomePoints: 250,
  welcomeFreeSpins: 2,
  jackpotTitle: 'Grand Jackpot',
  dailyBonusPoints: 100,
  dailyBonusSpins: 1,
  dailyBonusEnabled: true,
  soundEnabledByDefault: true,
  adminPasscode: process.env.ADMIN_PASSCODE || 'GAMBOLIN2026',
};

const INVEST_PLANS: InvestPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter Reserve Vault',
    termDays: 7,
    returnPercent: 4.5,
    minAmount: 50,
    maxAmount: 10000,
    bonusFreeSpins: 0,
    riskLevel: 'Low',
    description: 'Short-term 7-day reserve pool with steady linear yield accrual and instant exit.',
  },
  {
    id: 'plan-emerald',
    name: 'Emerald Growth Pool',
    termDays: 14,
    returnPercent: 9.0,
    minAmount: 150,
    maxAmount: 25000,
    bonusFreeSpins: 1,
    riskLevel: 'Balanced',
    description: 'Balanced 14-day liquidity pool awarding 9.0% target yield plus 1 Bonus Spin on deposit.',
  },
  {
    id: 'plan-treasury',
    name: 'Championship Treasury',
    termDays: 30,
    returnPercent: 16.5,
    minAmount: 500,
    maxAmount: 100000,
    bonusFreeSpins: 3,
    riskLevel: 'High Yield',
    description: '30-day flagship yield vault with 16.5% target return and 3 Bonus Spins credited upfront.',
  },
];

const KENYAN_BANKS = [
  'Equity Bank Kenya',
  'KCB Bank Kenya',
  'Co-operative Bank of Kenya',
  'NCBA Bank Kenya',
  'Absa Bank Kenya',
  'I&M Bank Kenya',
  'Stanbic Bank Kenya',
];

function hasDarajaCredentials(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY
  );
}

function toSafaricomE164(phone: string): string | null {
  const cleaned = phone.trim().replace(/[\s\-()]/g, '');
  if (/^\+254(7|1)\d{8}$/.test(cleaned)) {
    return cleaned.slice(1);
  }
  if (/^254(7|1)\d{8}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^0(7|1)\d{8}$/.test(cleaned)) {
    return `254${cleaned.slice(1)}`;
  }
  return null;
}

function generateMpesaReceipt(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix;
  for (let i = 0; i < 8; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }
  return code;
}

async function initiateDarajaStkPush(params: {
  phone254: string;
  amountKsh: number;
  accountRef: string;
}): Promise<{ checkoutRequestId: string }> {
  const baseUrl =
    process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

  const authString = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${authString}` } }
  );
  if (!tokenRes.ok) {
    throw new Error('Failed to authenticate with Safaricom Daraja OAuth.');
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error('Safaricom Daraja OAuth token missing.');
  }

  const now = new Date();
  const timestamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0'),
  ].join('');

  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const callbackBase = (process.env.APP_URL || '').replace(/\/$/, '');

  const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(params.amountKsh),
      PartyA: params.phone254,
      PartyB: shortcode,
      PhoneNumber: params.phone254,
      CallBackURL: `${callbackBase}/api/wallet/mpesa/callback`,
      AccountReference: params.accountRef,
      TransactionDesc: 'SPIN GAMBO LIN Wallet Deposit',
    }),
  });

  const stkJson = (await stkRes.json()) as {
    CheckoutRequestID?: string;
    ResponseCode?: string;
    errorMessage?: string;
  };
  if (!stkRes.ok || stkJson.ResponseCode !== '0' || !stkJson.CheckoutRequestID) {
    throw new Error(stkJson.errorMessage || 'Safaricom STK Push request was declined.');
  }

  return { checkoutRequestId: stkJson.CheckoutRequestID };
}

let dbCache: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function createInitialDb(): DatabaseSchema {
  return {
    prizes: DEFAULT_PRIZES,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    spins: [],
    redemptions: [],
    investments: [],
    walletTransactions: [],
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    nonceCounter: 1000,
  };
}

async function ensureDb(): Promise<DatabaseSchema> {
  if (dbCache) {
    return dbCache;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    dbCache = {
      prizes: Array.isArray(parsed.prizes) && parsed.prizes.length >= 2 ? parsed.prizes : DEFAULT_PRIZES,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      players: Array.isArray(parsed.players) ? parsed.players : [],
      spins: Array.isArray(parsed.spins) ? parsed.spins : [],
      redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : [],
      investments: Array.isArray(parsed.investments) ? parsed.investments : [],
      walletTransactions: Array.isArray(parsed.walletTransactions) ? parsed.walletTransactions : [],
      sessionSecret: parsed.sessionSecret || crypto.randomBytes(32).toString('hex'),
      nonceCounter: typeof parsed.nonceCounter === 'number' ? parsed.nonceCounter : 1000,
    };
  } catch {
    dbCache = createInitialDb();
    await persistDb(dbCache);
  }
  return dbCache;
}

function computeAccruedYield(pos: InvestmentPosition): number {
  if (pos.status === 'CLAIMED') {
    return Math.max(0, pos.payoutAmount - pos.principal);
  }
  const startMs = new Date(pos.createdAt).getTime();
  const endMs = new Date(pos.maturesAt).getTime();
  const totalMs = Math.max(1, endMs - startMs);
  const elapsedMs = Math.max(0, Date.now() - startMs);
  const ratio = Math.min(1, elapsedMs / totalMs);
  const maxYield = pos.principal * (pos.returnPercent / 100);
  return Math.round(maxYield * ratio * 100) / 100;
}

async function persistDb(db: DatabaseSchema): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tempFile = `${DB_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    await fs.rename(tempFile, DB_FILE);
  });
  return writeQueue;
}

function normalizePhone(input: string): string {
  const cleaned = input.trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+254')) {
    return `0${cleaned.slice(4)}`;
  }
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return `0${cleaned.slice(3)}`;
  }
  return cleaned;
}

function isValidPhone(phone: string): boolean {
  return /^\+?[0-9]{9,15}$/.test(phone);
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  const start = phone.slice(0, 3);
  const end = phone.slice(-3);
  return `${start}***${end}`;
}

function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(pin, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function signToken(playerId: string, secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({ pid: playerId, iat: Date.now() }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string, secret: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      pid?: string;
    };
    return decoded.pid || null;
  } catch {
    return null;
  }
}

function toPublicPlayer(p: StoredPlayer): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone,
    linkedWalletPhone: p.linkedWalletPhone || toSafaricomE164(p.phone) || p.phone,
    maskedPhone: maskPhone(p.phone),
    points: p.points,
    freeSpins: p.freeSpins,
    totalSpins: p.totalSpins,
    totalWonKsh: p.totalWonKsh,
    lastDailyClaimAt: p.lastDailyClaimAt,
    createdAt: p.createdAt,
  };
}

function toPublicSettings(s: GameSettings): PublicGameSettings {
  return {
    spinCostPoints: s.spinCostPoints,
    welcomePoints: s.welcomePoints,
    welcomeFreeSpins: s.welcomeFreeSpins,
    jackpotTitle: s.jackpotTitle,
    dailyBonusPoints: s.dailyBonusPoints,
    dailyBonusSpins: s.dailyBonusSpins,
    dailyBonusEnabled: s.dailyBonusEnabled,
    soundEnabledByDefault: s.soundEnabledByDefault,
  };
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const c of cookies) {
      if (c.startsWith('gambolin_token=')) {
        return decodeURIComponent(c.slice('gambolin_token='.length));
      }
    }
  }
  return null;
}

function setTokenCookie(res: Response, token: string): void {
  res.cookie('gambolin_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function selectFairPrize(
  activePrizes: PrizeSegment[],
  clientSeed: string,
  nonce: number
): { prize: PrizeSegment; prizeIndex: number; fairness: FairnessProof } {
  const serverSeed = crypto.randomBytes(32).toString('hex');
  const totalWeight = activePrizes.reduce((acc, p) => acc + Math.max(0, Math.round(p.weight)), 0);
  if (totalWeight <= 0) {
    throw new Error('Wheel has no positive probability weights configured.');
  }

  const input = `${serverSeed}:${clientSeed}:${nonce}`;
  const proofHash = crypto.createHash('sha256').update(input).digest('hex');
  const rollSeedInt = parseInt(proofHash.slice(0, 8), 16);
  const roll = rollSeedInt % totalWeight;

  let cumulative = 0;
  let chosenIndex = 0;
  for (let i = 0; i < activePrizes.length; i++) {
    cumulative += Math.max(0, Math.round(activePrizes[i].weight));
    if (roll < cumulative) {
      chosenIndex = i;
      break;
    }
  }

  return {
    prize: activePrizes[chosenIndex],
    prizeIndex: chosenIndex,
    fairness: {
      serverSeed,
      clientSeed,
      nonce,
      proofHash,
      roll,
      totalWeight,
      activeWeightsSnapshot: activePrizes.map((p) => ({
        id: p.id,
        label: p.label,
        weight: Math.max(0, Math.round(p.weight)),
      })),
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  await ensureDb();

  async function requirePlayer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const db = await ensureDb();
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ error: 'Please register or sign in to play.' });
      return;
    }
    const playerId = verifyToken(token, db.sessionSecret);
    if (!playerId) {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }
    const player = db.players.find((p) => p.id === playerId);
    if (!player) {
      res.status(401).json({ error: 'Player account not found.' });
      return;
    }
    (req as Request & { player: StoredPlayer }).player = player;
    next();
  }

  async function requireAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const db = await ensureDb();
    const passcode = req.headers['x-admin-passcode'];
    if (typeof passcode !== 'string' || passcode !== db.settings.adminPasscode) {
      res.status(403).json({ error: 'Invalid admin passcode.' });
      return;
    }
    next();
  }

  // Public Game State
  app.get('/api/game/state', async (_req, res) => {
    const db = await ensureDb();
    const activePrizes = db.prizes.filter((p) => p.enabled && p.weight > 0);
    const recentWinners: PublicWinnerFeedItem[] = db.spins
      .filter((s) => s.prizeType !== 'TRY_AGAIN')
      .slice(0, 12)
      .map((s) => ({
        id: s.id,
        playerName: s.playerName,
        maskedPhone: s.maskedPhone,
        prizeLabel: s.prizeLabel,
        prizeType: s.prizeType,
        prizeValue: s.prizeValue,
        createdAt: s.createdAt,
      }));

    res.json({
      prizes: activePrizes,
      settings: toPublicSettings(db.settings),
      recentWinners,
      totalSpinsPlayed: db.spins.length,
    });
  });

  // Register Player
  app.post('/api/auth/register', async (req, res) => {
    const db = await ensureDb();
    const { name, phone, pin } = req.body as {
      name?: string;
      phone?: string;
      pin?: string;
    };

    const cleanName = (name || '').trim();
    const normalizedPhone = normalizePhone(phone || '');
    const cleanPin = (pin || '').trim();

    if (cleanName.length < 2 || cleanName.length > 48) {
      res.status(400).json({ error: 'Please enter your full name (2–48 characters).' });
      return;
    }
    if (!isValidPhone(normalizedPhone)) {
      res.status(400).json({ error: 'Please enter a valid phone number (9–15 digits).' });
      return;
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      res.status(400).json({ error: 'Please choose a 4-digit PIN to protect your account.' });
      return;
    }

    const existing = db.players.find((p) => p.phone === normalizedPhone);
    if (existing) {
      res.status(409).json({
        error: 'This phone number is already registered. Please sign in with your PIN.',
      });
      return;
    }

    const newPlayer: StoredPlayer = {
      id: `plr_${crypto.randomUUID().slice(0, 10)}`,
      name: cleanName,
      phone: normalizedPhone,
      pinHash: hashPin(cleanPin),
      points: db.settings.welcomePoints,
      freeSpins: db.settings.welcomeFreeSpins,
      totalSpins: 0,
      totalWonKsh: 0,
      lastDailyClaimAt: null,
      createdAt: new Date().toISOString(),
    };

    db.players.unshift(newPlayer);
    await persistDb(db);

    const token = signToken(newPlayer.id, db.sessionSecret);
    setTokenCookie(res, token);

    res.status(201).json({
      token,
      player: toPublicPlayer(newPlayer),
      history: [],
      redemptions: [],
    });
  });

  // Sign In Player
  app.post('/api/auth/login', async (req, res) => {
    const db = await ensureDb();
    const { phone, pin } = req.body as { phone?: string; pin?: string };
    const normalizedPhone = normalizePhone(phone || '');
    const cleanPin = (pin || '').trim();

    const player = db.players.find((p) => p.phone === normalizedPhone);
    if (!player || !verifyPin(cleanPin, player.pinHash)) {
      res.status(401).json({ error: 'Invalid phone number or 4-digit PIN.' });
      return;
    }

    const token = signToken(player.id, db.sessionSecret);
    setTokenCookie(res, token);

    const history = db.spins.filter((s) => s.playerId === player.id).slice(0, 100);
    const redemptions = db.redemptions.filter((r) => r.playerId === player.id);

    res.json({
      token,
      player: toPublicPlayer(player),
      history,
      redemptions,
    });
  });

  // Sign Out
  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('gambolin_token', { path: '/' });
    res.json({ ok: true });
  });

  // Current Authenticated Player
  app.get('/api/auth/me', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const history = db.spins.filter((s) => s.playerId === player.id).slice(0, 100);
    const redemptions = db.redemptions.filter((r) => r.playerId === player.id);

    res.json({
      player: toPublicPlayer(player),
      history,
      redemptions,
    });
  });

  // Claim Daily Bonus
  app.post('/api/player/claim-daily', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;

    if (!db.settings.dailyBonusEnabled) {
      res.status(400).json({ error: 'Daily bonus is currently disabled by admin.' });
      return;
    }

    const now = Date.now();
    if (player.lastDailyClaimAt) {
      const last = new Date(player.lastDailyClaimAt).getTime();
      const hoursElapsed = (now - last) / (1000 * 60 * 60);
      if (hoursElapsed < 24) {
        const remainingHrs = Math.ceil(24 - hoursElapsed);
        res.status(429).json({
          error: `Daily bonus already claimed. Next bonus available in ${remainingHrs}h.`,
        });
        return;
      }
    }

    player.points += db.settings.dailyBonusPoints;
    player.freeSpins += db.settings.dailyBonusSpins;
    player.lastDailyClaimAt = new Date().toISOString();
    await persistDb(db);

    res.json({
      player: toPublicPlayer(player),
      awardedPoints: db.settings.dailyBonusPoints,
      awardedSpins: db.settings.dailyBonusSpins,
    });
  });

  // Redeem Winnings / Points
  app.post('/api/player/redeem', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const { amount } = req.body as { amount?: number };
    const cleanAmount = Math.floor(Number(amount || 0));

    if (!Number.isFinite(cleanAmount) || cleanAmount < 50) {
      res.status(400).json({ error: 'Minimum redemption amount is KSh 50 (50 Points).' });
      return;
    }
    if (player.points < cleanAmount) {
      res.status(400).json({ error: 'Insufficient available points for this redemption.' });
      return;
    }

    player.points -= cleanAmount;
    const redemption: RedemptionRecord = {
      id: `rdm_${crypto.randomUUID().slice(0, 8)}`,
      playerId: player.id,
      amountKsh: cleanAmount,
      phone: player.phone,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    db.redemptions.unshift(redemption);
    await persistDb(db);

    res.json({
      player: toPublicPlayer(player),
      redemption,
    });
  });

  // Instant Practice / Guest Spin using the exact same provably fair weighted RNG
  app.post('/api/spin/demo', async (req, res) => {
    const db = await ensureDb();
    const { clientSeed } = req.body as { clientSeed?: string };

    const activePrizes = db.prizes.filter((p) => p.enabled && p.weight > 0);
    if (activePrizes.length < 2) {
      res.status(503).json({ error: 'Wheel configuration must have at least 2 active prizes.' });
      return;
    }

    db.nonceCounter += 1;
    const cleanClientSeed =
      (clientSeed || '').trim().slice(0, 64) || crypto.randomBytes(8).toString('hex');

    const { prize, prizeIndex, fairness } = selectFairPrize(
      activePrizes,
      cleanClientSeed,
      db.nonceCounter
    );

    const spinRecord: SpinRecord = {
      id: `demo_${crypto.randomUUID().slice(0, 10)}`,
      playerId: 'guest',
      playerName: 'Guest Player',
      maskedPhone: 'Practice',
      prizeId: prize.id,
      prizeLabel: prize.label,
      prizeType: prize.type,
      prizeValue: prize.value,
      costPoints: 0,
      usedFreeSpin: true,
      netPointsDelta: 0,
      createdAt: new Date().toISOString(),
      fairness,
      isDemo: true,
    };

    res.json({
      prizeIndex,
      prize,
      spin: spinRecord,
    });
  });

  // Fair Server-Authoritative Spin
  app.post('/api/spin', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const { clientSeed } = req.body as { clientSeed?: string };

    const activePrizes = db.prizes.filter((p) => p.enabled && p.weight > 0);
    if (activePrizes.length < 2) {
      res.status(503).json({ error: 'Wheel configuration must have at least 2 active prizes.' });
      return;
    }

    let usedFreeSpin = false;
    let costPoints = 0;

    if (player.freeSpins > 0) {
      usedFreeSpin = true;
      player.freeSpins -= 1;
    } else if (player.points >= db.settings.spinCostPoints) {
      costPoints = db.settings.spinCostPoints;
      player.points -= costPoints;
    } else {
      res.status(400).json({
        error: `You need ${db.settings.spinCostPoints} points or a Bonus Spin to play.`,
      });
      return;
    }

    db.nonceCounter += 1;
    const cleanClientSeed =
      (clientSeed || '').trim().slice(0, 64) || crypto.randomBytes(8).toString('hex');

    const { prize, prizeIndex, fairness } = selectFairPrize(
      activePrizes,
      cleanClientSeed,
      db.nonceCounter
    );

    let netPointsDelta = -costPoints;
    if (prize.type === 'CASH_KSH' || prize.type === 'JACKPOT') {
      player.points += prize.value;
      player.totalWonKsh += prize.value;
      netPointsDelta += prize.value;
    } else if (prize.type === 'BONUS_SPIN') {
      player.freeSpins += Math.max(1, prize.value);
    }

    player.totalSpins += 1;

    const spinRecord: SpinRecord = {
      id: `spn_${crypto.randomUUID().slice(0, 10)}`,
      playerId: player.id,
      playerName: player.name,
      maskedPhone: maskPhone(player.phone),
      prizeId: prize.id,
      prizeLabel: prize.label,
      prizeType: prize.type,
      prizeValue: prize.value,
      costPoints,
      usedFreeSpin,
      netPointsDelta,
      createdAt: new Date().toISOString(),
      fairness,
    };

    db.spins.unshift(spinRecord);
    if (db.spins.length > 1000) {
      db.spins = db.spins.slice(0, 1000);
    }
    await persistDb(db);

    res.json({
      prizeIndex,
      prize,
      spin: spinRecord,
      player: toPublicPlayer(player),
    });
  });

  // Public Investment Plans
  app.get('/api/invest/plans', async (_req, res) => {
    const db = await ensureDb();
    const activePoolTotal = db.investments
      .filter((i) => i.status === 'ACTIVE')
      .reduce((sum, i) => sum + i.principal, 0);

    res.json({
      plans: INVEST_PLANS,
      activePoolTotal,
    });
  });

  // Player Investment Portfolio
  app.get('/api/invest/portfolio', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const positions = db.investments
      .filter((i) => i.playerId === player.id)
      .map((pos) => ({
        ...pos,
        accruedYield: computeAccruedYield(pos),
      }));

    const activePositions = positions.filter((p) => p.status === 'ACTIVE');
    const totalPrincipal = activePositions.reduce((sum, p) => sum + p.principal, 0);
    const accruedYield =
      Math.round(
        activePositions.reduce((sum, p) => sum + (p.accruedYield || 0), 0) * 100
      ) / 100;

    res.json({
      plans: INVEST_PLANS,
      positions,
      totals: {
        totalPrincipal,
        currentValue: Math.round((totalPrincipal + accruedYield) * 100) / 100,
        accruedYield,
        activeCount: activePositions.length,
      },
    });
  });

  // Create New Investment Position
  app.post('/api/invest/deposit', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const { planId, amount } = req.body as { planId?: string; amount?: number };

    const plan = INVEST_PLANS.find((p) => p.id === planId);
    if (!plan) {
      res.status(404).json({ error: 'Selected investment plan was not found.' });
      return;
    }

    const cleanAmount = Math.floor(Number(amount || 0));
    if (!Number.isFinite(cleanAmount) || cleanAmount < plan.minAmount || cleanAmount > plan.maxAmount) {
      res.status(400).json({
        error: `Investment amount must be between ${plan.minAmount.toLocaleString()} and ${plan.maxAmount.toLocaleString()} Pts.`,
      });
      return;
    }

    if (player.points < cleanAmount) {
      res.status(400).json({ error: 'Insufficient available points for this investment.' });
      return;
    }

    player.points -= cleanAmount;
    if (plan.bonusFreeSpins > 0) {
      player.freeSpins += plan.bonusFreeSpins;
    }

    const now = Date.now();
    const maturesAt = new Date(now + plan.termDays * 24 * 60 * 60 * 1000).toISOString();

    const position: InvestmentPosition = {
      id: `inv_${crypto.randomUUID().slice(0, 10)}`,
      playerId: player.id,
      planId: plan.id,
      planName: plan.name,
      principal: cleanAmount,
      returnPercent: plan.returnPercent,
      termDays: plan.termDays,
      bonusFreeSpinsAwarded: plan.bonusFreeSpins,
      status: 'ACTIVE',
      createdAt: new Date(now).toISOString(),
      maturesAt,
      claimedAt: null,
      payoutAmount: 0,
    };

    db.investments.unshift(position);
    await persistDb(db);

    res.status(201).json({
      player: toPublicPlayer(player),
      position: { ...position, accruedYield: 0 },
    });
  });

  // Claim / Withdraw Investment Position
  app.post('/api/invest/positions/:id/claim', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const position = db.investments.find(
      (i) => i.id === req.params.id && i.playerId === player.id
    );

    if (!position) {
      res.status(404).json({ error: 'Investment position not found.' });
      return;
    }
    if (position.status === 'CLAIMED') {
      res.status(400).json({ error: 'This investment position has already been claimed.' });
      return;
    }

    const earnedYield = Math.floor(computeAccruedYield(position));
    const payout = position.principal + earnedYield;
    position.status = 'CLAIMED';
    position.claimedAt = new Date().toISOString();
    position.payoutAmount = payout;

    player.points += payout;
    await persistDb(db);

    res.json({
      player: toPublicPlayer(player),
      position: { ...position, accruedYield: earnedYield },
      payout,
    });
  });

  // Wallet Overview (Safaricom M-Pesa & Kenyan Banks)
  app.get('/api/wallet/overview', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const transactions = db.walletTransactions
      .filter((t) => t.playerId === player.id)
      .slice(0, 60);

    res.json({
      mpesaMode: hasDarajaCredentials() ? 'DARAJA_LIVE' : 'SANDBOX',
      banks: KENYAN_BANKS,
      transactions,
    });
  });

  // Connect / Update Safaricom M-Pesa Phone Number Wallet
  app.post('/api/wallet/connect-phone', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const { phone } = req.body as { phone?: string };
    const phone254 = toSafaricomE164(phone || '');
    if (!phone254) {
      res.status(400).json({
        error: 'Enter a valid Safaricom phone number (e.g. 0712345678, 0112345678, or 254712345678).',
      });
      return;
    }

    player.linkedWalletPhone = phone254;
    await persistDb(db);
    res.json({
      player: toPublicPlayer(player),
      connectedPhone: phone254,
      message: `Phone wallet ${phone254} connected for Safaricom M-Pesa deposits & withdrawals.`,
    });
  });

  // Deposit via Safaricom M-Pesa STK Push or Bank Transfer
  app.post('/api/wallet/deposit', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const { channel, amountKsh, phone, bankName, accountNumber, accountName } = req.body as {
      channel?: PaymentChannel;
      amountKsh?: number;
      phone?: string;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    };

    const cleanAmount = Math.floor(Number(amountKsh || 0));
    if (channel !== 'MPESA_SAFARICOM' && channel !== 'BANK_TRANSFER') {
      res.status(400).json({ error: 'Please select Safaricom M-Pesa or Bank Transfer.' });
      return;
    }

    if (channel === 'MPESA_SAFARICOM') {
      if (!Number.isFinite(cleanAmount) || cleanAmount < 10 || cleanAmount > 150000) {
        res.status(400).json({ error: 'M-Pesa deposits must be between KSh 10 and KSh 150,000.' });
        return;
      }
      const phone254 = toSafaricomE164(phone || player.linkedWalletPhone || player.phone);
      if (!phone254) {
        res.status(400).json({
          error: 'Enter a valid Safaricom M-Pesa number (e.g. 0712345678 or 254712345678).',
        });
        return;
      }

      if (hasDarajaCredentials()) {
        try {
          const { checkoutRequestId } = await initiateDarajaStkPush({
            phone254,
            amountKsh: cleanAmount,
            accountRef: player.id,
          });
          const tx: WalletTransaction = {
            id: `wtx_${crypto.randomUUID().slice(0, 10)}`,
            playerId: player.id,
            type: 'DEPOSIT',
            channel: 'MPESA_SAFARICOM',
            amountKsh: cleanAmount,
            phoneOrAccount: phone254,
            referenceCode: checkoutRequestId,
            checkoutRequestId,
            mode: 'DARAJA_LIVE',
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          db.walletTransactions.unshift(tx);
          await persistDb(db);
          res.status(202).json({
            player: toPublicPlayer(player),
            transaction: tx,
            message: `M-Pesa STK Push sent to ${phone254}. Enter your PIN on your phone to confirm.`,
          });
          return;
        } catch (err) {
          res.status(502).json({
            error: err instanceof Error ? err.message : 'M-Pesa STK Push request failed.',
          });
          return;
        }
      }

      // Sandbox Mode settlement
      const receipt = generateMpesaReceipt('SGM');
      player.points += cleanAmount;
      const tx: WalletTransaction = {
        id: `wtx_${crypto.randomUUID().slice(0, 10)}`,
        playerId: player.id,
        type: 'DEPOSIT',
        channel: 'MPESA_SAFARICOM',
        amountKsh: cleanAmount,
        phoneOrAccount: phone254,
        referenceCode: receipt,
        mode: 'SANDBOX',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      };
      db.walletTransactions.unshift(tx);
      await persistDb(db);

      res.status(201).json({
        player: toPublicPlayer(player),
        transaction: tx,
        message: `Sandbox M-Pesa STK Push confirmed for ${phone254}. Receipt ${receipt} (+${cleanAmount.toLocaleString()} Pts).`,
      });
      return;
    }

    // BANK_TRANSFER Deposit
    if (!Number.isFinite(cleanAmount) || cleanAmount < 100 || cleanAmount > 1000000) {
      res.status(400).json({ error: 'Bank deposits must be between KSh 100 and KSh 1,000,000.' });
      return;
    }
    const cleanBank = (bankName || '').trim();
    const cleanAccNum = (accountNumber || '').trim().replace(/\s+/g, '');
    const cleanAccName = (accountName || player.name).trim();

    if (!KENYAN_BANKS.includes(cleanBank)) {
      res.status(400).json({ error: 'Please choose a supported Kenyan bank.' });
      return;
    }
    if (!/^[0-9A-Za-z]{6,20}$/.test(cleanAccNum)) {
      res.status(400).json({ error: 'Please enter a valid bank account number (6–20 characters).' });
      return;
    }

    const receipt = generateMpesaReceipt('BNK');
    player.points += cleanAmount;
    const tx: WalletTransaction = {
      id: `wtx_${crypto.randomUUID().slice(0, 10)}`,
      playerId: player.id,
      type: 'DEPOSIT',
      channel: 'BANK_TRANSFER',
      amountKsh: cleanAmount,
      phoneOrAccount: cleanAccNum,
      bankName: cleanBank,
      accountName: cleanAccName,
      referenceCode: receipt,
      mode: 'SANDBOX',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    db.walletTransactions.unshift(tx);
    await persistDb(db);

    res.status(201).json({
      player: toPublicPlayer(player),
      transaction: tx,
      message: `Bank deposit via ${cleanBank} confirmed. Reference ${receipt} (+${cleanAmount.toLocaleString()} Pts).`,
    });
  });

  // Withdraw via Safaricom M-Pesa or Bank Transfer
  app.post('/api/wallet/withdraw', requirePlayer, async (req, res) => {
    const db = await ensureDb();
    const player = (req as Request & { player: StoredPlayer }).player;
    const { channel, amountKsh, phone, bankName, accountNumber, accountName } = req.body as {
      channel?: PaymentChannel;
      amountKsh?: number;
      phone?: string;
      bankName?: string;
      accountNumber?: string;
      accountName?: string;
    };

    const cleanAmount = Math.floor(Number(amountKsh || 0));
    if (channel !== 'MPESA_SAFARICOM' && channel !== 'BANK_TRANSFER') {
      res.status(400).json({ error: 'Please select Safaricom M-Pesa or Bank Transfer.' });
      return;
    }

    if (!Number.isFinite(cleanAmount) || cleanAmount < 50) {
      res.status(400).json({ error: 'Minimum withdrawal amount is KSh 50 (50 Points).' });
      return;
    }
    if (player.points < cleanAmount) {
      res.status(400).json({ error: 'Insufficient available balance for this withdrawal.' });
      return;
    }

    if (channel === 'MPESA_SAFARICOM') {
      const phone254 = toSafaricomE164(phone || player.linkedWalletPhone || player.phone);
      if (!phone254) {
        res.status(400).json({
          error: 'Enter a valid Safaricom M-Pesa number (e.g. 0712345678 or 254712345678).',
        });
        return;
      }

      player.points -= cleanAmount;
      const receipt = generateMpesaReceipt('MPO');
      const tx: WalletTransaction = {
        id: `wtx_${crypto.randomUUID().slice(0, 10)}`,
        playerId: player.id,
        type: 'WITHDRAW',
        channel: 'MPESA_SAFARICOM',
        amountKsh: cleanAmount,
        phoneOrAccount: phone254,
        referenceCode: receipt,
        mode: hasDarajaCredentials() ? 'DARAJA_LIVE' : 'SANDBOX',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      };
      db.walletTransactions.unshift(tx);
      await persistDb(db);

      res.status(201).json({
        player: toPublicPlayer(player),
        transaction: tx,
        message: `M-Pesa payout of KSh ${cleanAmount.toLocaleString()} sent to ${phone254}. Ref ${receipt}.`,
      });
      return;
    }

    // BANK_TRANSFER Withdrawal
    const cleanBank = (bankName || '').trim();
    const cleanAccNum = (accountNumber || '').trim().replace(/\s+/g, '');
    const cleanAccName = (accountName || player.name).trim();

    if (!KENYAN_BANKS.includes(cleanBank)) {
      res.status(400).json({ error: 'Please choose a supported Kenyan bank.' });
      return;
    }
    if (!/^[0-9A-Za-z]{6,20}$/.test(cleanAccNum)) {
      res.status(400).json({ error: 'Please enter a valid bank account number (6–20 characters).' });
      return;
    }

    player.points -= cleanAmount;
    const receipt = generateMpesaReceipt('EFT');
    const tx: WalletTransaction = {
      id: `wtx_${crypto.randomUUID().slice(0, 10)}`,
      playerId: player.id,
      type: 'WITHDRAW',
      channel: 'BANK_TRANSFER',
      amountKsh: cleanAmount,
      phoneOrAccount: cleanAccNum,
      bankName: cleanBank,
      accountName: cleanAccName,
      referenceCode: receipt,
      mode: 'SANDBOX',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };
    db.walletTransactions.unshift(tx);
    await persistDb(db);

    res.status(201).json({
      player: toPublicPlayer(player),
      transaction: tx,
      message: `Bank payout of KSh ${cleanAmount.toLocaleString()} queued to ${cleanBank} (${cleanAccNum}). Ref ${receipt}.`,
    });
  });

  // Safaricom Daraja STK Push Callback Webhook
  app.post('/api/wallet/mpesa/callback', async (req, res) => {
    const db = await ensureDb();
    const body = req.body as {
      Body?: {
        stkCallback?: {
          CheckoutRequestID?: string;
          ResultCode?: number;
          CallbackMetadata?: { Item?: Array<{ Name?: string; Value?: unknown }> };
        };
      };
    };
    const cb = body?.Body?.stkCallback;
    if (cb?.CheckoutRequestID) {
      const tx = db.walletTransactions.find(
        (t) => t.checkoutRequestId === cb.CheckoutRequestID && t.status === 'PENDING'
      );
      if (tx) {
        if (cb.ResultCode === 0) {
          tx.status = 'COMPLETED';
          const receiptItem = cb.CallbackMetadata?.Item?.find(
            (i) => i.Name === 'MpesaReceiptNumber'
          );
          if (receiptItem?.Value) {
            tx.referenceCode = String(receiptItem.Value);
          }
          const player = db.players.find((p) => p.id === tx.playerId);
          if (player) {
            player.points += tx.amountKsh;
          }
        } else {
          tx.status = 'FAILED';
        }
        await persistDb(db);
      }
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  });

  // Admin Verify
  app.post('/api/admin/verify', requireAdmin, (_req, res) => {
    res.json({ ok: true });
  });

  // Admin Overview
  app.get('/api/admin/overview', requireAdmin, async (_req, res) => {
    const db = await ensureDb();
    const totalAwardedKsh = db.spins.reduce(
      (sum, s) => (s.prizeType === 'CASH_KSH' || s.prizeType === 'JACKPOT' ? sum + s.prizeValue : sum),
      0
    );
    const jackpotHits = db.spins.filter((s) => s.prizeType === 'JACKPOT').length;

    res.json({
      prizes: db.prizes,
      settings: db.settings,
      players: db.players.map(toPublicPlayer),
      recentSpins: db.spins.slice(0, 80),
      redemptions: db.redemptions.slice(0, 50),
      stats: {
        totalPlayers: db.players.length,
        totalSpins: db.spins.length,
        totalAwardedKsh,
        jackpotHits,
      },
    });
  });

  // Admin Update Prizes
  app.put('/api/admin/prizes', requireAdmin, async (req, res) => {
    const db = await ensureDb();
    const { prizes } = req.body as { prizes?: PrizeSegment[] };
    if (!Array.isArray(prizes) || prizes.length < 2 || prizes.length > 16) {
      res.status(400).json({ error: 'Wheel must have between 2 and 16 prize segments.' });
      return;
    }

    const sanitized: PrizeSegment[] = prizes.map((p, idx) => ({
      id: (p.id || `prize-${idx + 1}`).trim(),
      label: (p.label || 'Prize').trim().slice(0, 24),
      type: p.type,
      value: Math.max(0, Math.round(Number(p.value || 0))),
      weight: Math.max(0, Math.round(Number(p.weight || 0))),
      color: /^#[0-9A-Fa-f]{6}$/.test(p.color || '') ? p.color : '#047857',
      textColor: /^#[0-9A-Fa-f]{6}$/.test(p.textColor || '') ? p.textColor : '#FFFFFF',
      enabled: Boolean(p.enabled),
    }));

    const activeWeight = sanitized
      .filter((p) => p.enabled)
      .reduce((acc, p) => acc + p.weight, 0);
    if (sanitized.filter((p) => p.enabled && p.weight > 0).length < 2 || activeWeight <= 0) {
      res.status(400).json({
        error: 'At least 2 enabled segments must have positive probability weights.',
      });
      return;
    }

    db.prizes = sanitized;
    await persistDb(db);
    res.json({ prizes: db.prizes });
  });

  // Admin Update Settings
  app.put('/api/admin/settings', requireAdmin, async (req, res) => {
    const db = await ensureDb();
    const incoming = req.body as Partial<GameSettings>;

    const next: GameSettings = {
      spinCostPoints: Math.max(0, Math.round(Number(incoming.spinCostPoints ?? db.settings.spinCostPoints))),
      welcomePoints: Math.max(0, Math.round(Number(incoming.welcomePoints ?? db.settings.welcomePoints))),
      welcomeFreeSpins: Math.max(0, Math.round(Number(incoming.welcomeFreeSpins ?? db.settings.welcomeFreeSpins))),
      jackpotTitle: (incoming.jackpotTitle || db.settings.jackpotTitle).trim().slice(0, 32),
      dailyBonusPoints: Math.max(0, Math.round(Number(incoming.dailyBonusPoints ?? db.settings.dailyBonusPoints))),
      dailyBonusSpins: Math.max(0, Math.round(Number(incoming.dailyBonusSpins ?? db.settings.dailyBonusSpins))),
      dailyBonusEnabled:
        typeof incoming.dailyBonusEnabled === 'boolean'
          ? incoming.dailyBonusEnabled
          : db.settings.dailyBonusEnabled,
      soundEnabledByDefault:
        typeof incoming.soundEnabledByDefault === 'boolean'
          ? incoming.soundEnabledByDefault
          : db.settings.soundEnabledByDefault,
      adminPasscode:
        incoming.adminPasscode && incoming.adminPasscode.trim().length >= 4
          ? incoming.adminPasscode.trim()
          : db.settings.adminPasscode,
    };

    db.settings = next;
    await persistDb(db);
    res.json({ settings: db.settings });
  });

  // Admin Adjust Player Balance
  app.post('/api/admin/players/:id/adjust', requireAdmin, async (req, res) => {
    const db = await ensureDb();
    const player = db.players.find((p) => p.id === req.params.id);
    if (!player) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    const { pointsDelta, freeSpinsDelta } = req.body as {
      pointsDelta?: number;
      freeSpinsDelta?: number;
    };
    player.points = Math.max(0, player.points + Math.round(Number(pointsDelta || 0)));
    player.freeSpins = Math.max(0, player.freeSpins + Math.round(Number(freeSpinsDelta || 0)));
    await persistDb(db);
    res.json({ player: toPublicPlayer(player) });
  });

  const httpServer = http.createServer(app);

  // Vite or Static Serving
  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`SPIN GAMBO LIN server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
