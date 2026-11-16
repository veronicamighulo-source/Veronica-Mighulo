import React, { useState } from 'react';
import { LogOut, Phone, Shield, User } from 'lucide-react';
import type { PublicGameSettings, PublicPlayer } from '../types/game';

interface PlayerAuthViewProps {
  player: PublicPlayer | null;
  settings: PublicGameSettings | null;
  onRegister: (payload: { name: string; phone: string; pin: string }) => Promise<void>;
  onLogin: (payload: { phone: string; pin: string }) => Promise<void>;
  onLogout: () => Promise<void>;
  onGoPlay: () => void;
}

export const PlayerAuthView: React.FC<PlayerAuthViewProps> = ({
  player,
  settings,
  onRegister,
  onLogin,
  onLogout,
  onGoPlay,
}) => {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await onRegister({ name, phone, pin });
      } else {
        await onLogin({ phone, pin });
      }
      onGoPlay();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (player) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-amber-500/20 bg-[#10221E] p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-xs font-medium text-emerald-400">Active Player Account</p>
              <h1 className="mt-1 font-display text-2xl font-bold text-white">{player.name}</h1>
              <p className="mt-1 font-mono text-sm text-slate-300">{player.phone}</p>
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
              <p className="text-xs text-slate-400">Total Spins</p>
              <p className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                {player.totalSpins}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Won</p>
              <p className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                KSh {player.totalWonKsh.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onGoPlay}
              className="rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
            >
              Back to Wheel
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-amber-500/20 bg-[#10221E] p-6 sm:p-7">
          <div>
            <p className="text-xs font-medium text-amber-300">Player Registration</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-white text-balance">
              Register to Spin &amp; Track Winnings
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Create your SPIN GAMBO LIN player profile using your name and phone number. Your
              available points, bonus spins, and full provably fair spin history are saved
              securely.
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-white/10 pt-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Welcome Points</span>
              <span className="font-mono font-semibold text-amber-300 tabular-nums">
                +{settings?.welcomePoints ?? 250} Pts
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Welcome Free Spins</span>
              <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                +{settings?.welcomeFreeSpins ?? 2} Spins
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Standard Spin Cost</span>
              <span className="font-mono font-semibold text-slate-200 tabular-nums">
                {settings?.spinCostPoints ?? 50} Pts
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-white/10 bg-[#10221E] p-6 sm:p-8">
          <div className="inline-flex rounded-lg border border-white/10 bg-[#091311] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              New Player Registration
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Returning Player Sign In
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="player-name" className="block text-xs font-medium text-slate-300">
                  Full Name
                </label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="player-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={48}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Brian Kamau"
                    className="w-full rounded-lg border border-white/15 bg-[#091311] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="player-phone" className="block text-xs font-medium text-slate-300">
                Phone Number
              </label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="player-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712 345 678 or +254712345678"
                  className="w-full rounded-lg border border-white/15 bg-[#091311] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="player-pin" className="block text-xs font-medium text-slate-300">
                4-Digit Security PIN
              </label>
              <div className="relative mt-1.5">
                <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="player-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4 digits (e.g. 1234)"
                  className="w-full rounded-lg border border-white/15 bg-[#091311] py-2.5 pl-10 pr-4 font-mono text-sm text-white placeholder:font-sans placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Used to secure your balance and sign back in with your phone number.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-60 whitespace-nowrap"
            >
              {submitting
                ? 'Submitting...'
                : mode === 'register'
                  ? 'Create Player Account'
                  : 'Sign In to Play'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
