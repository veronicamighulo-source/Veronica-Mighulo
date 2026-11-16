import React, { useState } from 'react';
import { Gift, Phone, Shield, ShieldCheck, Smartphone, User } from 'lucide-react';
import type {
  PublicGameSettings,
  PublicPlayer,
  RedemptionRecord,
  SpinRecord,
} from '../types/game';
import { WalletCashier } from './WalletCashier';

interface HistoryViewProps {
  player: PublicPlayer | null;
  history: SpinRecord[];
  redemptions: RedemptionRecord[];
  settings: PublicGameSettings | null;
  onPlayerUpdated: (player: PublicPlayer) => void;
  onRegister: (payload: { name: string; phone: string; pin: string }) => Promise<void>;
  onLogin: (payload: { phone: string; pin: string }) => Promise<void>;
  onClaimDaily: () => Promise<string>;
  onRedeem: (amount: number) => Promise<void>;
  onInspectFairness: (spin: SpinRecord) => void;
  onGoAuth: () => void;
  onGoPlay: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  player,
  history,
  settings,
  onPlayerUpdated,
  onRegister,
  onLogin,
  onClaimDaily,
  onInspectFairness,
  onGoPlay,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [connectMode, setConnectMode] = useState<'register' | 'login'>('register');
  const [connectName, setConnectName] = useState('');
  const [connectPhone, setConnectPhone] = useState('');
  const [connectPin, setConnectPin] = useState('');
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const handleWalletConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnecting(true);
    try {
      if (connectMode === 'register') {
        await onRegister({ name: connectName, phone: connectPhone, pin: connectPin });
      } else {
        await onLogin({ phone: connectPhone, pin: connectPin });
      }
    } catch (err) {
      setConnectError(
        err instanceof Error ? err.message : 'Could not connect phone wallet.'
      );
    } finally {
      setConnecting(false);
    }
  };

  if (!player) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-emerald-500/25 bg-[#10221E] p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-400">
                Safaricom M-Pesa &amp; Bank Wallet
              </p>
              <h1 className="font-display text-2xl font-bold text-white">
                Connect Phone Number to Deposit &amp; Withdraw
              </h1>
            </div>
          </div>

          <div className="mt-5 inline-flex rounded-lg border border-white/10 bg-[#091311] p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setConnectMode('register');
                setConnectError(null);
              }}
              className={`rounded-md px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                connectMode === 'register'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Connect New Phone Wallet
            </button>
            <button
              type="button"
              onClick={() => {
                setConnectMode('login');
                setConnectError(null);
              }}
              className={`rounded-md px-4 py-2 font-semibold transition-colors whitespace-nowrap ${
                connectMode === 'login'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Existing Phone Wallet Sign In
            </button>
          </div>

          <form onSubmit={handleWalletConnectSubmit} className="mt-5 space-y-4">
            {connectMode === 'register' && (
              <div>
                <label htmlFor="wallet-name" className="block text-xs font-medium text-slate-300">
                  Full Name
                </label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="wallet-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={48}
                    value={connectName}
                    onChange={(e) => setConnectName(e.target.value)}
                    placeholder="e.g. Brian Kamau"
                    className="w-full rounded-lg border border-white/15 bg-[#091311] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="wallet-phone" className="block text-xs font-medium text-slate-300">
                Phone Number (Safaricom M-Pesa)
              </label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="wallet-phone"
                  type="tel"
                  required
                  value={connectPhone}
                  onChange={(e) => setConnectPhone(e.target.value)}
                  placeholder="0712 345 678 or 254712345678"
                  className="w-full rounded-lg border border-white/15 bg-[#091311] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wallet-pin" className="block text-xs font-medium text-slate-300">
                4-Digit Wallet PIN
              </label>
              <div className="relative mt-1.5">
                <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="wallet-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  value={connectPin}
                  onChange={(e) => setConnectPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4 digits (e.g. 1234)"
                  className="w-full rounded-lg border border-white/15 bg-[#091311] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            {connectError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-200"
              >
                {connectError}
              </div>
            )}

            <button
              type="submit"
              disabled={connecting}
              className="w-full rounded-lg bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-60 whitespace-nowrap"
            >
              {connecting
                ? 'Connecting Phone Wallet...'
                : connectMode === 'register'
                  ? 'Connect Phone Number & Open Wallet'
                  : 'Sign In & Open Wallet'}
            </button>
          </form>
        </div>
      </section>
    );
  }

    const handleDaily = async () => {
    setFeedback(null);
    setBusy(true);
    try {
      const msg = await onClaimDaily();
      setFeedback({ type: 'ok', text: msg });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not claim daily bonus.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 space-y-8">
      {/* Player Wallet Summary */}
      <div className="rounded-xl border border-amber-500/20 bg-[#10221E] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs text-slate-400">
              {player.name} · <span className="font-mono">{player.phone}</span>
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-white">
              Wallet, M-Pesa Cashier &amp; Spin History
            </h1>
          </div>
          <button
            type="button"
            onClick={onGoPlay}
            className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
          >
            Spin Wheel
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-400">Available Points / KSh</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {player.points.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Bonus Spins</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              {player.freeSpins}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Spins Played</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {player.totalSpins}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Cash Prizes Won</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              KSh {player.totalWonKsh.toLocaleString()}
            </p>
          </div>
        </div>

        {settings?.dailyBonusEnabled && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
            <div className="flex items-center gap-3">
              <Gift className="h-5 w-5 text-amber-300 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Daily Loyalty Bonus</p>
                <p className="text-xs text-slate-400">
                  +{settings.dailyBonusPoints} Points and +{settings.dailyBonusSpins} Free Spin
                  every 24 hours
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleDaily}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50 whitespace-nowrap"
            >
              Claim Daily Bonus
            </button>
          </div>
        )}

        {feedback && (
          <p
            className={`mt-3 text-xs font-medium ${
              feedback.type === 'ok' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>

      {/* Safaricom M-Pesa & Bank Deposit / Withdraw */}
      <WalletCashier player={player} onPlayerUpdated={onPlayerUpdated} />

      {/* Spin History Table */}
      <div className="rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Spin History</h2>
            <p className="text-xs text-slate-400">
              Every spin outcome is logged with a verifiable SHA-256 fairness proof.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-300 tabular-nums">
            {history.length} recorded {history.length === 1 ? 'spin' : 'spins'}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-slate-300">You haven&apos;t spun the wheel yet.</p>
            <button
              type="button"
              onClick={onGoPlay}
              className="mt-4 rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300"
            >
              Take Your First Spin
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-[#0B1916] text-xs font-medium text-slate-400">
                <tr>
                  <th className="px-6 py-3">Date &amp; Time</th>
                  <th className="px-6 py-3">Prize Outcome</th>
                  <th className="px-6 py-3 text-right">Spin Entry</th>
                  <th className="px-6 py-3 text-right">Net Points</th>
                  <th className="px-6 py-3 text-right">Fairness</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((spin) => (
                  <tr key={spin.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3.5 font-mono text-xs text-slate-300 whitespace-nowrap tabular-nums">
                      {new Date(spin.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-white whitespace-nowrap">
                      <span
                        className={
                          spin.prizeType === 'JACKPOT'
                            ? 'text-amber-300'
                            : spin.prizeType === 'CASH_KSH'
                              ? 'text-emerald-300'
                              : spin.prizeType === 'BONUS_SPIN'
                                ? 'text-violet-300'
                                : 'text-slate-400'
                        }
                      >
                        {spin.prizeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs text-slate-300 whitespace-nowrap tabular-nums">
                      {spin.usedFreeSpin ? 'Free Spin' : `${spin.costPoints} Pts`}
                    </td>
                    <td
                      className={`px-6 py-3.5 text-right font-mono text-xs font-semibold whitespace-nowrap tabular-nums ${
                        spin.netPointsDelta > 0
                          ? 'text-emerald-400'
                          : spin.netPointsDelta < 0
                            ? 'text-slate-400'
                            : 'text-slate-300'
                      }`}
                    >
                      {spin.netPointsDelta > 0
                        ? `+${spin.netPointsDelta}`
                        : spin.netPointsDelta}{' '}
                      Pts
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectFairness(spin)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-300 hover:text-amber-200"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verify #{spin.fairness.nonce}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
