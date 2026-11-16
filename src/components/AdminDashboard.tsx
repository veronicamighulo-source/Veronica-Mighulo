import React, { useEffect, useState } from 'react';
import { Lock, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import type {
  AdminOverviewResponse,
  GameSettings,
  PrizeSegment,
  PrizeType,
} from '../types/game';
import {
  apiRequest,
  getStoredAdminPasscode,
  setStoredAdminPasscode,
} from '../utils/api';

interface AdminDashboardProps {
  onGameConfigChanged: () => Promise<void>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onGameConfigChanged }) => {
  const [passcode, setPasscode] = useState(() => getStoredAdminPasscode() || '');
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [section, setSection] = useState<'prizes' | 'settings' | 'players'>('prizes');

  const [prizesDraft, setPrizesDraft] = useState<PrizeSegment[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<GameSettings | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [playerSearch, setPlayerSearch] = useState('');

  const loadOverview = async (code: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const data = await apiRequest<AdminOverviewResponse>('/api/admin/overview', {
        adminPasscode: code,
      });
      setOverview(data);
      setPrizesDraft(data.prizes);
      setSettingsDraft(data.settings);
      setUnlocked(true);
      setStoredAdminPasscode(code);
    } catch (err) {
      setUnlocked(false);
      setStoredAdminPasscode(null);
      setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = getStoredAdminPasscode();
    if (saved) {
      void loadOverview(saved);
    }
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    await loadOverview(passcode.trim());
  };

  const handleSavePrizes = async () => {
    setSaveMessage(null);
    try {
      const res = await apiRequest<{ prizes: PrizeSegment[] }>('/api/admin/prizes', {
        method: 'PUT',
        adminPasscode: passcode,
        body: JSON.stringify({ prizes: prizesDraft }),
      });
      setPrizesDraft(res.prizes);
      await onGameConfigChanged();
      await loadOverview(passcode);
      setSaveMessage({ type: 'ok', text: 'Wheel prizes and probability weights updated.' });
    } catch (err) {
      setSaveMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save prizes.',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    setSaveMessage(null);
    try {
      const res = await apiRequest<{ settings: GameSettings }>('/api/admin/settings', {
        method: 'PUT',
        adminPasscode: passcode,
        body: JSON.stringify(settingsDraft),
      });
      setSettingsDraft(res.settings);
      setPasscode(res.settings.adminPasscode);
      setStoredAdminPasscode(res.settings.adminPasscode);
      await onGameConfigChanged();
      setSaveMessage({ type: 'ok', text: 'Game settings saved.' });
    } catch (err) {
      setSaveMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save settings.',
      });
    }
  };

  const handleGrantPlayer = async (
    playerId: string,
    pointsDelta: number,
    freeSpinsDelta: number
  ) => {
    setSaveMessage(null);
    try {
      await apiRequest(`/api/admin/players/${playerId}/adjust`, {
        method: 'POST',
        adminPasscode: passcode,
        body: JSON.stringify({ pointsDelta, freeSpinsDelta }),
      });
      await loadOverview(passcode);
      setSaveMessage({ type: 'ok', text: 'Player balance updated.' });
    } catch (err) {
      setSaveMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to adjust player.',
      });
    }
  };

  if (!unlocked) {
    return (
      <section className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-amber-500/20 bg-[#10221E] p-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">Admin Console</h1>
              <p className="text-xs text-slate-400">Manage prizes, odds, and game rules</p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-passcode" className="block text-xs font-medium text-slate-300">
                Admin Passcode
              </label>
              <input
                id="admin-passcode"
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter admin passcode"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3.5 py-2.5 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-slate-400">
                Default demo passcode: <code className="font-mono text-amber-300">GAMBOLIN2026</code>
              </p>
            </div>

            {authError && (
              <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Unlock Dashboard'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const totalActiveWeight = prizesDraft
    .filter((p) => p.enabled)
    .reduce((sum, p) => sum + Math.max(0, Number(p.weight) || 0), 0);

  const filteredPlayers = (overview?.players || []).filter(
    (p) =>
      p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      p.phone.includes(playerSearch)
  );

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 space-y-6">
      {/* Header + Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            SPIN GAMBO LIN Admin Dashboard
          </h1>
          <p className="text-xs text-slate-400">
            Configure wheel segments, transparent probability weights, and platform economics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadOverview(passcode)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setStoredAdminPasscode(null);
              setUnlocked(false);
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
          >
            Lock
          </button>
        </div>
      </div>

      {/* KPI Row */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-[#10221E] p-4">
            <p className="text-xs text-slate-400">Registered Players</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {overview.stats.totalPlayers.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10221E] p-4">
            <p className="text-xs text-slate-400">Total Spins Played</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {overview.stats.totalSpins.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10221E] p-4">
            <p className="text-xs text-slate-400">Total Cash Awarded</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              KSh {overview.stats.totalAwardedKsh.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#10221E] p-4">
            <p className="text-xs text-slate-400">Jackpot Hits</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {overview.stats.jackpotHits.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Segmented Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="inline-flex rounded-lg border border-white/10 bg-[#0B1916] p-1">
          {(
            [
              { id: 'prizes', label: 'Prizes & Odds' },
              { id: 'settings', label: 'Game Settings' },
              { id: 'players', label: 'Players & Spins' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSection(tab.id);
                setSaveMessage(null);
              }}
              className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                section === tab.id
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {saveMessage && (
          <p
            className={`text-xs font-medium ${
              saveMessage.type === 'ok' ? 'text-emerald-300' : 'text-red-300'
            }`}
          >
            {saveMessage.text}
          </p>
        )}
      </div>

      {/* Section 1: Prizes & Weights */}
      {section === 'prizes' && (
        <div className="rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Wheel Prize Segments</h2>
              <p className="text-xs text-slate-400">
                Active weight pool:{' '}
                <span className="font-mono text-amber-300 tabular-nums">{totalActiveWeight}</span>
                . Odds adjust automatically based on each segment&apos;s weight.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={prizesDraft.length >= 16}
                onClick={() =>
                  setPrizesDraft((prev) => [
                    ...prev,
                    {
                      id: `prize-${Date.now()}`,
                      label: 'KSh 25',
                      type: 'CASH_KSH',
                      value: 25,
                      weight: 10,
                      color: '#0D9488',
                      textColor: '#FFFFFF',
                      enabled: true,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Segment
              </button>
              <button
                type="button"
                onClick={() => void handleSavePrizes()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
              >
                <Save className="h-3.5 w-3.5" />
                Save Wheel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-[#0B1916] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Value (KSh / Spins)</th>
                  <th className="px-4 py-3">Weight</th>
                  <th className="px-4 py-3 text-right">Odds %</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {prizesDraft.map((prize, idx) => {
                  const pct =
                    prize.enabled && totalActiveWeight > 0
                      ? ((prize.weight / totalActiveWeight) * 100).toFixed(2)
                      : '0.00';

                  const updateRow = (patch: Partial<PrizeSegment>) => {
                    setPrizesDraft((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, ...patch } : row))
                    );
                  };

                  return (
                    <tr key={prize.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={prize.enabled}
                          onChange={(e) => updateRow({ enabled: e.target.checked })}
                          aria-label={`Enable ${prize.label}`}
                          className="h-4 w-4 accent-amber-400"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={prize.label}
                          maxLength={24}
                          onChange={(e) => updateRow({ label: e.target.value })}
                          className="w-32 rounded border border-white/15 bg-[#091311] px-2.5 py-1.5 text-white focus:border-amber-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={prize.type}
                          onChange={(e) => updateRow({ type: e.target.value as PrizeType })}
                          className="rounded border border-white/15 bg-[#091311] px-2 py-1.5 text-slate-200 focus:border-amber-400 focus:outline-none"
                        >
                          <option value="JACKPOT">JACKPOT</option>
                          <option value="CASH_KSH">CASH_KSH</option>
                          <option value="BONUS_SPIN">BONUS_SPIN</option>
                          <option value="TRY_AGAIN">TRY_AGAIN</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          value={prize.value}
                          onChange={(e) => updateRow({ value: Number(e.target.value) })}
                          className="w-24 rounded border border-white/15 bg-[#091311] px-2.5 py-1.5 font-mono text-white tabular-nums focus:border-amber-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          value={prize.weight}
                          onChange={(e) => updateRow({ weight: Number(e.target.value) })}
                          className="w-20 rounded border border-white/15 bg-[#091311] px-2.5 py-1.5 font-mono text-white tabular-nums focus:border-amber-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-amber-300 tabular-nums">
                        {pct}%
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="color"
                          value={prize.color}
                          onChange={(e) => updateRow({ color: e.target.value })}
                          aria-label={`Color for ${prize.label}`}
                          className="h-7 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={prizesDraft.length <= 2}
                          onClick={() =>
                            setPrizesDraft((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`Delete ${prize.label}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2: Game Settings */}
      {section === 'settings' && settingsDraft && (
        <form
          onSubmit={handleSaveSettings}
          className="rounded-xl border border-white/10 bg-[#10221E] p-6 space-y-6"
        >
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Spin Cost (Points)
              </label>
              <input
                type="number"
                min={0}
                value={settingsDraft.spinCostPoints}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, spinCostPoints: Number(e.target.value) })
                }
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                New Player Welcome Points
              </label>
              <input
                type="number"
                min={0}
                value={settingsDraft.welcomePoints}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, welcomePoints: Number(e.target.value) })
                }
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                New Player Welcome Free Spins
              </label>
              <input
                type="number"
                min={0}
                value={settingsDraft.welcomeFreeSpins}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, welcomeFreeSpins: Number(e.target.value) })
                }
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Daily Bonus Points
              </label>
              <input
                type="number"
                min={0}
                value={settingsDraft.dailyBonusPoints}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, dailyBonusPoints: Number(e.target.value) })
                }
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Daily Bonus Free Spins
              </label>
              <input
                type="number"
                min={0}
                value={settingsDraft.dailyBonusSpins}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, dailyBonusSpins: Number(e.target.value) })
                }
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">
                Admin Passcode
              </label>
              <input
                type="text"
                minLength={4}
                value={settingsDraft.adminPasscode}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, adminPasscode: e.target.value })
                }
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6 border-t border-white/10 pt-5 text-sm">
            <label className="inline-flex items-center gap-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsDraft.dailyBonusEnabled}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, dailyBonusEnabled: e.target.checked })
                }
                className="h-4 w-4 accent-amber-400"
              />
              Enable 24-hour Daily Loyalty Bonus
            </label>

            <label className="inline-flex items-center gap-2.5 text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsDraft.soundEnabledByDefault}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    soundEnabledByDefault: e.target.checked,
                  })
                }
                className="h-4 w-4 accent-amber-400"
              />
              Enable Game Sound Effects by Default
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </div>
        </form>
      )}

      {/* Section 3: Players & Recent Spins */}
      {section === 'players' && overview && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6 rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-white">Registered Players</h2>
              <input
                type="search"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="Search name or phone..."
                className="rounded-lg border border-white/15 bg-[#091311] px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
            {filteredPlayers.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No registered players match your filter yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#0B1916] text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Player</th>
                      <th className="px-4 py-2.5 text-right">Points</th>
                      <th className="px-4 py-2.5 text-right">Free</th>
                      <th className="px-4 py-2.5 text-right">Grant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredPlayers.map((pl) => (
                      <tr key={pl.id}>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-white">{pl.name}</p>
                          <p className="font-mono text-[11px] text-slate-400">{pl.phone}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-300 tabular-nums">
                          {pl.points.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400 tabular-nums">
                          {pl.freeSpins}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => void handleGrantPlayer(pl.id, 100, 0)}
                            className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                          >
                            +100 Pts
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleGrantPlayer(pl.id, 0, 1)}
                            className="rounded border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/25"
                          >
                            +1 Spin
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-base font-bold text-white">Recent Global Spins</h2>
            </div>
            {overview.recentSpins.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-400">
                No spins recorded yet.
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/10 bg-[#0B1916] text-slate-400">
                    <tr>
                      <th className="px-4 py-2.5">Player</th>
                      <th className="px-4 py-2.5">Prize</th>
                      <th className="px-4 py-2.5 text-right">Nonce / Roll</th>
                      <th className="px-4 py-2.5 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {overview.recentSpins.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5 text-white">
                          {s.playerName}{' '}
                          <span className="font-mono text-slate-400">({s.maskedPhone})</span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-amber-300">
                          {s.prizeLabel}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300 tabular-nums">
                          #{s.fairness.nonce} · {s.fairness.roll}/{s.fairness.totalWeight}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-400 tabular-nums">
                          {new Date(s.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
