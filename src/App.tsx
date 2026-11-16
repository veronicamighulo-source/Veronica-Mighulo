import React, { useCallback, useEffect, useState } from 'react';
import { History, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'motion/react';
import { AdminDashboard } from './components/AdminDashboard';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { FairnessView } from './components/FairnessView';
import { HistoryView } from './components/HistoryView';
import { InvestDashboard } from './components/InvestDashboard';
import { type ActiveTab, Navbar } from './components/Navbar';
import { PlayerAuthView } from './components/PlayerAuthView';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { SpinWheel } from './components/SpinWheel';
import type {
  PrizeSegment,
  PublicGameSettings,
  PublicPlayer,
  PublicWinnerFeedItem,
  RedemptionRecord,
  SpinRecord,
} from './types/game';
import { apiRequest, getStoredToken, setStoredToken } from './utils/api';
import { soundEngine } from './utils/soundEngine';

interface GameStateResponse {
  prizes: PrizeSegment[];
  settings: PublicGameSettings;
  recentWinners: PublicWinnerFeedItem[];
  totalSpinsPlayed: number;
}

interface AuthResponse {
  token?: string;
  player: PublicPlayer;
  history: SpinRecord[];
  redemptions: RedemptionRecord[];
}

interface SpinResponse {
  prizeIndex: number;
  prize: PrizeSegment;
  spin: SpinRecord;
  player: PublicPlayer;
}

const INITIAL_WHEEL_PRIZES: PrizeSegment[] = [
  { id: 'prize-jackpot', label: 'Jackpot', type: 'JACKPOT', value: 5000, weight: 1, color: '#D97706', textColor: '#FFFBEB', enabled: true },
  { id: 'prize-ksh-10', label: 'KSh 10', type: 'CASH_KSH', value: 10, weight: 26, color: '#047857', textColor: '#ECFDF5', enabled: true },
  { id: 'prize-try-again-1', label: 'Try Again', type: 'TRY_AGAIN', value: 0, weight: 22, color: '#1E293B', textColor: '#CBD5E1', enabled: true },
  { id: 'prize-ksh-50', label: 'KSh 50', type: 'CASH_KSH', value: 50, weight: 15, color: '#0F766E', textColor: '#F0FDFA', enabled: true },
  { id: 'prize-bonus-spin', label: 'Bonus Spin', type: 'BONUS_SPIN', value: 1, weight: 10, color: '#7C3AED', textColor: '#F5F3FF', enabled: true },
  { id: 'prize-ksh-100', label: 'KSh 100', type: 'CASH_KSH', value: 100, weight: 8, color: '#2563EB', textColor: '#EFF6FF', enabled: true },
  { id: 'prize-try-again-2', label: 'Try Again', type: 'TRY_AGAIN', value: 0, weight: 13, color: '#334155', textColor: '#E2E8F0', enabled: true },
  { id: 'prize-ksh-500', label: 'KSh 500', type: 'CASH_KSH', value: 500, weight: 5, color: '#DC2626', textColor: '#FEF2F2', enabled: true },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('play');
  const [prizes, setPrizes] = useState<PrizeSegment[]>(INITIAL_WHEEL_PRIZES);
  const [settings, setSettings] = useState<PublicGameSettings | null>(null);
  const [recentWinners, setRecentWinners] = useState<PublicWinnerFeedItem[]>([]);
  const [totalSpinsPlayed, setTotalSpinsPlayed] = useState(0);

  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [history, setHistory] = useState<SpinRecord[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRecord[]>([]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [spinTriggerId, setSpinTriggerId] = useState(0);
  const [pendingResult, setPendingResult] = useState<{
    spin: SpinRecord;
    player: PublicPlayer | null;
  } | null>(null);
  const [celebrationSpin, setCelebrationSpin] = useState<SpinRecord | null>(null);
  const [inspectedSpin, setInspectedSpin] = useState<SpinRecord | null>(null);
  const [spinError, setSpinError] = useState<string | null>(null);
  const [clientSeed, setClientSeed] = useState(() =>
    Math.random().toString(36).slice(2, 12)
  );

  const fetchGameState = useCallback(async () => {
    try {
      const data = await apiRequest<GameStateResponse>('/api/game/state');
      setPrizes(data.prizes);
      setSettings(data.settings);
      setRecentWinners(data.recentWinners);
      setTotalSpinsPlayed(data.totalSpinsPlayed);
      setSoundEnabled(data.settings.soundEnabledByDefault);
      soundEngine.setEnabled(data.settings.soundEnabledByDefault);
    } catch {
      // Keep current state on transient failure
    }
  }, []);

  const fetchCurrentPlayer = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const data = await apiRequest<AuthResponse>('/api/auth/me');
      setPlayer(data.player);
      setHistory(data.history);
      setRedemptions(data.redemptions);
    } catch {
      setStoredToken(null);
      setPlayer(null);
    }
  }, []);

  useEffect(() => {
    void fetchGameState();
    void fetchCurrentPlayer();
  }, [fetchGameState, fetchCurrentPlayer]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setEnabled(next);
    if (next) {
      soundEngine.playClick();
    }
  };

  const handleRegister = async (payload: { name: string; phone: string; pin: string }) => {
    const data = await apiRequest<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) setStoredToken(data.token);
    setPlayer(data.player);
    setHistory(data.history);
    setRedemptions(data.redemptions);
    setSpinError(null);
  };

  const handleLogin = async (payload: { phone: string; pin: string }) => {
    const data = await apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) setStoredToken(data.token);
    setPlayer(data.player);
    setHistory(data.history);
    setRedemptions(data.redemptions);
    setSpinError(null);
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setStoredToken(null);
    setPlayer(null);
    setHistory([]);
    setRedemptions([]);
  };

  const handleClaimDaily = async (): Promise<string> => {
    const data = await apiRequest<{
      player: PublicPlayer;
      awardedPoints: number;
      awardedSpins: number;
    }>('/api/player/claim-daily', { method: 'POST' });
    setPlayer(data.player);
    return `Daily bonus claimed: +${data.awardedPoints} Points & +${data.awardedSpins} Free Spin.`;
  };

  const handleRedeem = async (amount: number): Promise<void> => {
    const data = await apiRequest<{
      player: PublicPlayer;
      redemption: RedemptionRecord;
    }>('/api/player/redeem', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    setPlayer(data.player);
    setRedemptions((prev) => [data.redemption, ...prev]);
  };

  const handleRequestSpin = async () => {
    if (spinning) return;
    setSpinError(null);

    if (!player) {
      setSpinning(true);
      try {
        const res = await apiRequest<{
          prizeIndex: number;
          prize: PrizeSegment;
          spin: SpinRecord;
        }>('/api/spin/demo', {
          method: 'POST',
          body: JSON.stringify({ clientSeed }),
        });
        setPendingResult({ spin: res.spin, player: null });
        setTargetIndex(res.prizeIndex);
        setSpinTriggerId((prev) => prev + 1);
      } catch (err) {
        setSpinning(false);
        setSpinError(err instanceof Error ? err.message : 'Unable to start spin.');
      }
      return;
    }

    const spinCost = settings?.spinCostPoints ?? 50;
    if (player.freeSpins <= 0 && player.points < spinCost) {
      setSpinError(
        `You need ${spinCost} points or a Bonus Spin to spin. Claim your Daily Bonus in History.`
      );
      return;
    }

    setSpinning(true);
    try {
      const res = await apiRequest<SpinResponse>('/api/spin', {
        method: 'POST',
        body: JSON.stringify({ clientSeed }),
      });
      setPendingResult({ spin: res.spin, player: res.player });
      setTargetIndex(res.prizeIndex);
      setSpinTriggerId((prev) => prev + 1);
    } catch (err) {
      setSpinning(false);
      setSpinError(err instanceof Error ? err.message : 'Unable to start spin.');
    }
  };

  const handleSpinComplete = useCallback(() => {
    setSpinning(false);
    if (!pendingResult) return;

    const { spin, player: updatedPlayer } = pendingResult;
    if (updatedPlayer) {
      setPlayer(updatedPlayer);
      setHistory((prev) => [spin, ...prev]);
    }
    setCelebrationSpin(spin);
    setPendingResult(null);

    if (spin.prizeType === 'JACKPOT') {
      soundEngine.playJackpotWin();
    } else if (spin.prizeType === 'CASH_KSH') {
      soundEngine.playCashWin();
    } else if (spin.prizeType === 'BONUS_SPIN') {
      soundEngine.playBonusSpin();
    } else {
      soundEngine.playTryAgain();
    }

    void fetchGameState();
  }, [pendingResult, fetchGameState]);

  const handleInspectFairness = (spin: SpinRecord) => {
    setCelebrationSpin(null);
    setInspectedSpin(spin);
    setActiveTab('fairness');
  };

  const spinCost = settings?.spinCostPoints ?? 50;
  const canSpin = !player || player.freeSpins > 0 || player.points >= spinCost;
  const spinButtonSubtext = !player
    ? 'Free Try'
    : player.freeSpins > 0
      ? 'Free Spin'
      : `${spinCost} Pts`;

  const totalWeight = prizes.reduce((sum, p) => sum + Math.max(0, p.weight), 0);
  const jackpotPrize = prizes.find((p) => p.type === 'JACKPOT');

  return (
    <div className="relative min-h-screen flex flex-col bg-[#091311] text-slate-100">
      {/* Full-viewport luxury gaming arena backdrop with high-contrast scrim */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <img
          src="/src/assets/images/gaming_arena_bg_1794821894282.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#091311]/75 via-[#091311]/88 to-[#091311]" />
      </div>

      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} player={player} />

      <main className="relative z-10 flex-1">
        {activeTab === 'play' && (
          <div className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-10 space-y-10">
            {/* Hero Arena Split */}
            <section className="grid gap-8 lg:grid-cols-12 items-center">
              {/* Wheel Column */}
              <div className="lg:col-span-7 flex flex-col items-center">
                <div className="mb-4 flex w-full max-w-[460px] items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-amber-300">
                      Provably Fair Wheel · {totalSpinsPlayed.toLocaleString()} Total Spins
                    </p>
                    <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                      Spin &amp; Win Instant KSh
                    </h1>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PWAInstallButton variant="toolbar" />
                    <motion.button
                      type="button"
                      onClick={toggleSound}
                      whileTap={{ scale: 0.92 }}
                      whileHover={{ scale: 1.03 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                      aria-label={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#10221E] px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
                    >
                      <motion.span
                        key={soundEnabled ? 'sound-on' : 'sound-off'}
                        initial={{ scale: 0.7, rotate: -18 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        className="inline-flex items-center"
                      >
                        {soundEnabled ? (
                          <Volume2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <VolumeX className="h-4 w-4 text-slate-400" />
                        )}
                      </motion.span>
                      {soundEnabled ? 'Sound On' : 'Muted'}
                    </motion.button>
                  </div>
                </div>

                <SpinWheel
                  prizes={prizes}
                  spinning={spinning}
                  targetIndex={targetIndex}
                  spinTriggerId={spinTriggerId}
                  canSpin={canSpin}
                  spinButtonSubtext={spinButtonSubtext}
                  onRequestSpin={() => void handleRequestSpin()}
                  onSpinComplete={handleSpinComplete}
                />

                {spinError && (
                  <div
                    role="alert"
                    className="mt-4 max-w-md rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-center text-xs font-medium text-red-200"
                  >
                    {spinError}
                  </div>
                )}
              </div>

              {/* Player HUD / Quick Registration & Jackpot Card */}
              <div className="lg:col-span-5 space-y-5">
                {/* Jackpot Highlight */}
                <div className="flex items-center gap-4 rounded-xl border border-amber-400/25 bg-[#10221E]/95 p-5">
                  <img
                    src="/src/assets/images/jackpot_trophy_emblem_1794821893536.jpg"
                    alt="Grand Jackpot Trophy"
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-lg border border-amber-400/30 object-cover shrink-0"
                  />
                  <div>
                    <p className="text-xs font-medium text-amber-300">
                      {settings?.jackpotTitle || 'Grand Jackpot'}
                    </p>
                    <p className="font-display text-2xl font-extrabold text-white tabular-nums">
                      KSh {(jackpotPrize?.value ?? 5000).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {jackpotPrize && totalWeight > 0
                        ? `Transparent odds: ${((jackpotPrize.weight / totalWeight) * 100).toFixed(1)}% per spin`
                        : 'Random weighted selection'}
                    </p>
                  </div>
                </div>

                {/* Player Balance or Registration CTA */}
                {player ? (
                  <div className="rounded-xl border border-white/10 bg-[#10221E]/95 p-6 space-y-5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div>
                        <p className="text-xs text-slate-400">Signed in as</p>
                        <h2 className="font-display text-lg font-bold text-white">
                          {player.name}
                        </h2>
                        <p className="font-mono text-xs text-slate-400">{player.phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 whitespace-nowrap"
                      >
                        <History className="h-3.5 w-3.5" />
                        Deposit / Withdraw
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-400">Available Points</p>
                        <p className="mt-1 font-mono text-xl font-bold text-amber-300 tabular-nums">
                          {player.points.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Bonus Spins</p>
                        <p className="mt-1 font-mono text-xl font-bold text-emerald-400 tabular-nums">
                          {player.freeSpins}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Won (KSh)</p>
                        <p className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                          {player.totalWonKsh.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-4">
                      <label
                        htmlFor="client-seed-input"
                        className="flex items-center justify-between text-xs text-slate-400"
                      >
                        <span>Your Provably Fair Client Seed</span>
                        <button
                          type="button"
                          onClick={() => setClientSeed(Math.random().toString(36).slice(2, 12))}
                          className="text-amber-300 hover:text-amber-200"
                        >
                          Randomize
                        </button>
                      </label>
                      <input
                        id="client-seed-input"
                        type="text"
                        value={clientSeed}
                        onChange={(e) => setClientSeed(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#091311] px-3 py-1.5 font-mono text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-400/20 bg-[#10221E]/95 p-6 space-y-4">
                    <h2 className="font-display text-xl font-bold text-white">
                      New Player Bonus Ready
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Register with your name and phone number to claim{' '}
                      <strong className="text-amber-300">
                        {settings?.welcomePoints ?? 250} Points
                      </strong>{' '}
                      and{' '}
                      <strong className="text-emerald-400">
                        {settings?.welcomeFreeSpins ?? 2} Free Spins
                      </strong>{' '}
                      immediately.
                    </p>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('auth')}
                        className="flex-1 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
                      >
                        Register to Play
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 whitespace-nowrap"
                      >
                        Connect Phone Wallet
                      </button>
                    </div>
                  </div>
                )}

                {/* Recent Spin History Preview or Live Winners */}
                <div className="rounded-xl border border-white/10 bg-[#10221E]/95 p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="font-display text-sm font-bold text-white">
                      {player && history.length > 0 ? 'Your Latest Spins' : 'Recent Platform Wins'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab(player ? 'history' : 'fairness')}
                      className="text-xs font-medium text-amber-300 hover:text-amber-200"
                    >
                      {player ? 'Full History' : 'Verify Fairness'}
                    </button>
                  </div>

                  {player && history.length > 0 ? (
                    <ul className="mt-3 divide-y divide-white/5 text-xs">
                      {history.slice(0, 4).map((item) => (
                        <li key={item.id} className="flex items-center justify-between py-2">
                          <span className="font-semibold text-white">{item.prizeLabel}</span>
                          <span className="font-mono text-slate-400 tabular-nums">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : recentWinners.length > 0 ? (
                    <ul className="mt-3 divide-y divide-white/5 text-xs">
                      {recentWinners.slice(0, 4).map((w) => (
                        <li key={w.id} className="flex items-center justify-between py-2">
                          <span className="text-slate-200">
                            {w.playerName}{' '}
                            <span className="font-mono text-slate-500">({w.maskedPhone})</span>
                          </span>
                          <span className="font-semibold text-emerald-400">{w.prizeLabel}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">
                      Be the first player to spin the wheel and record a verified win today.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Prize & Transparent Odds Strip */}
            <section className="border-t border-white/10 pt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    Wheel Prizes &amp; Transparent Odds
                  </h2>
                  <p className="text-xs text-slate-400">
                    No guaranteed winnings — every spin outcome is independently verifiable.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('fairness')}
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200"
                >
                  Open SHA-256 Verifier
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {prizes.map((prize) => {
                  const pct =
                    totalWeight > 0 ? ((prize.weight / totalWeight) * 100).toFixed(1) : '0.0';
                  return (
                    <div
                      key={prize.id}
                      className="rounded-lg border border-white/10 bg-[#10221E] p-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: prize.color }}
                        />
                        <span className="truncate text-xs font-bold text-white">
                          {prize.label}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs text-amber-300 tabular-nums">
                        {pct}% chance
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'invest' && (
          <InvestDashboard
            player={player}
            onPlayerUpdated={(updated) => setPlayer(updated)}
            onGoAuth={() => setActiveTab('auth')}
          />
        )}

        {activeTab === 'auth' && (
          <PlayerAuthView
            player={player}
            settings={settings}
            onRegister={handleRegister}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onGoPlay={() => setActiveTab('play')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            player={player}
            history={history}
            redemptions={redemptions}
            settings={settings}
            onPlayerUpdated={(updated) => setPlayer(updated)}
            onRegister={handleRegister}
            onLogin={handleLogin}
            onClaimDaily={handleClaimDaily}
            onRedeem={handleRedeem}
            onInspectFairness={handleInspectFairness}
            onGoAuth={() => setActiveTab('auth')}
            onGoPlay={() => setActiveTab('play')}
          />
        )}

        {activeTab === 'fairness' && (
          <FairnessView prizes={prizes} inspectedSpin={inspectedSpin} />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard onGameConfigChanged={fetchGameState} />
        )}
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-[#091311]/90 py-5">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-400 sm:px-6">
          <span>SPIN GAMBO LIN · Provably Fair Spin &amp; Win Platform</span>
          <div className="flex items-center gap-5">
            <PWAInstallButton variant="footer" />
            <button
              type="button"
              onClick={() => setActiveTab('fairness')}
              className="hover:text-white transition-colors"
            >
              Fairness &amp; Odds
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="hover:text-white transition-colors"
            >
              Admin Console
            </button>
          </div>
        </div>
      </footer>

      <OfflineIndicator />

      <CelebrationOverlay
        spin={celebrationSpin}
        onClose={() => setCelebrationSpin(null)}
        onSpinAgain={() => {
          setCelebrationSpin(null);
          void handleRequestSpin();
        }}
        onRegisterToClaim={() => {
          setCelebrationSpin(null);
          setActiveTab('auth');
        }}
        onInspectFairness={handleInspectFairness}
      />
    </div>
  );
}
