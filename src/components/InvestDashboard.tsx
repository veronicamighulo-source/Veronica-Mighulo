import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type {
  InvestPlan,
  InvestPortfolioResponse,
  InvestmentPosition,
  PublicPlayer,
} from '../types/game';
import { apiRequest } from '../utils/api';

interface InvestDashboardProps {
  player: PublicPlayer | null;
  onPlayerUpdated: (player: PublicPlayer) => void;
  onGoAuth: () => void;
}

export const InvestDashboard: React.FC<InvestDashboardProps> = ({
  player,
  onPlayerUpdated,
  onGoAuth,
}) => {
  const [plans, setPlans] = useState<InvestPlan[]>([]);
  const [positions, setPositions] = useState<InvestmentPosition[]>([]);
  const [totals, setTotals] = useState({
    totalPrincipal: 0,
    currentValue: 0,
    accruedYield: 0,
    activeCount: 0,
  });
  const [activePoolTotal, setActivePoolTotal] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('plan-emerald');
  const [amountInput, setAmountInput] = useState<string>('200');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'CLAIMED'>('ALL');
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const publicRes = await apiRequest<{
        plans: InvestPlan[];
        activePoolTotal: number;
      }>('/api/invest/plans');
      setPlans(publicRes.plans);
      setActivePoolTotal(publicRes.activePoolTotal);

      if (player) {
        const portfolio = await apiRequest<InvestPortfolioResponse>('/api/invest/portfolio');
        setPositions(portfolio.positions);
        setTotals(portfolio.totals);
      } else {
        setPositions([]);
        setTotals({ totalPrincipal: 0, currentValue: 0, accruedYield: 0, activeCount: 0 });
      }
    } catch {
      // Keep prior state on transient error
    } finally {
      setLoading(false);
    }
  }, [player]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedPlan =
    plans.find((p) => p.id === selectedPlanId) || plans[0] || null;

  const parsedAmount = Math.max(0, Math.floor(Number(amountInput) || 0));
  const projectedYield = selectedPlan
    ? Math.round(parsedAmount * (selectedPlan.returnPercent / 100) * 100) / 100
    : 0;
  const projectedTotal = Math.round((parsedAmount + projectedYield) * 100) / 100;

  const handleSelectPlan = (plan: InvestPlan) => {
    setSelectedPlanId(plan.id);
    setFeedback(null);
    if (parsedAmount < plan.minAmount) {
      setAmountInput(String(plan.minAmount));
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player) {
      onGoAuth();
      return;
    }
    if (!selectedPlan) return;

    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        player: PublicPlayer;
        position: InvestmentPosition;
      }>('/api/invest/deposit', {
        method: 'POST',
        body: JSON.stringify({ planId: selectedPlan.id, amount: parsedAmount }),
      });
      onPlayerUpdated(res.player);
      setFeedback({
        type: 'ok',
        text: `Allocated ${res.position.principal.toLocaleString()} Pts to ${res.position.planName}${
          res.position.bonusFreeSpinsAwarded > 0
            ? ` (+${res.position.bonusFreeSpinsAwarded} Bonus Spin unlocked)`
            : ''
        }.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to allocate investment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaim = async (positionId: string) => {
    setFeedback(null);
    setClaimingId(positionId);
    try {
      const res = await apiRequest<{
        player: PublicPlayer;
        position: InvestmentPosition;
        payout: number;
      }>(`/api/invest/positions/${positionId}/claim`, {
        method: 'POST',
      });
      onPlayerUpdated(res.player);
      setFeedback({
        type: 'ok',
        text: `Withdrew ${res.payout.toLocaleString()} Pts back into your available balance.`,
      });
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not withdraw position.',
      });
    } finally {
      setClaimingId(null);
    }
  };

  // Interactive SVG projection curve data
  const termDays = selectedPlan?.termDays ?? 14;
  const chartBasePrincipal = parsedAmount > 0 ? parsedAmount : selectedPlan?.minAmount ?? 200;
  const chartMaxReturn = selectedPlan?.returnPercent ?? 9;
  const pointsCount = Math.min(30, Math.max(7, termDays));

  const chartSeries = Array.from({ length: pointsCount + 1 }, (_, idx) => {
    const day = Math.round((idx / pointsCount) * termDays);
    const ratio = idx / pointsCount;
    const total =
      chartBasePrincipal + chartBasePrincipal * (chartMaxReturn / 100) * ratio;
    return { day, total, principal: chartBasePrincipal };
  });

  const minVal = chartBasePrincipal * 0.96;
  const maxVal = Math.max(
    chartBasePrincipal * 1.02,
    chartBasePrincipal * (1 + chartMaxReturn / 100) * 1.03
  );
  const svgW = 560;
  const svgH = 190;
  const padX = 16;
  const padY = 18;

  const toX = (idx: number) =>
    padX + (idx / pointsCount) * (svgW - padX * 2);
  const toY = (val: number) =>
    svgH - padY - ((val - minVal) / Math.max(1, maxVal - minVal)) * (svgH - padY * 2);

  const linePath = chartSeries
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(pt.total).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${toX(pointsCount).toFixed(1)} ${(svgH - padY).toFixed(
    1
  )} L ${toX(0).toFixed(1)} ${(svgH - padY).toFixed(1)} Z`;
  const baselineY = toY(chartBasePrincipal);

  const activePointIdx =
    hoverDay !== null
      ? Math.min(pointsCount, Math.max(0, Math.round((hoverDay / termDays) * pointsCount)))
      : pointsCount;
  const activePoint = chartSeries[activePointIdx] || chartSeries[chartSeries.length - 1];

  const filteredPositions = positions.filter((p) =>
    filterStatus === 'ALL' ? true : p.status === filterStatus
  );

  return (
    <section className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 space-y-8">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium text-amber-300">
            Yield Vaults · Platform Pool{' '}
            <span className="font-mono tabular-nums">
              {activePoolTotal.toLocaleString()} Pts
            </span>
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold text-white">
            Invest Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Allocate available points into fixed-term vaults to earn transparent yield and unlock
            bonus spins.
          </p>
        </div>
        {!player && (
          <button
            type="button"
            onClick={onGoAuth}
            className="rounded-lg bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
          >
            Register to Invest
          </button>
        )}
      </div>

      {/* 4-KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#10221E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Available Wallet</span>
            <Wallet className="h-4 w-4 text-amber-300" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-300 tabular-nums">
            {player ? `${player.points.toLocaleString()} Pts` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {player ? `${player.freeSpins} Bonus Spins ready` : 'Sign in to view wallet'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10221E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Principal</span>
            <Layers className="h-4 w-4 text-slate-300" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
            {totals.totalPrincipal.toLocaleString()} Pts
          </p>
          <p className="mt-1 text-xs text-slate-400 tabular-nums">
            {totals.activeCount} active {totals.activeCount === 1 ? 'position' : 'positions'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10221E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Current Portfolio</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-white tabular-nums">
            {totals.currentValue.toLocaleString()} Pts
          </p>
          <p className="mt-1 text-xs text-emerald-400 tabular-nums">
            Principal + accrued yield
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10221E] p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Accrued Yield</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            +{totals.accruedYield.toLocaleString()} Pts
          </p>
          <p className="mt-1 text-xs text-slate-400">Accrues linearly over term</p>
        </div>
      </div>

      {/* Vault Plans Selection */}
      <div>
        <h2 className="font-display text-lg font-bold text-white mb-3">
          Select an Investment Vault
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const active = selectedPlan?.id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleSelectPlan(plan)}
                className={`text-left rounded-xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                  active
                    ? 'border-amber-400 bg-[#152D27]'
                    : 'border-white/10 bg-[#10221E] hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-400">
                      {plan.termDays} Days · {plan.riskLevel}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold text-white">
                      {plan.name}
                    </h3>
                  </div>
                  <span className="font-mono text-xl font-extrabold text-emerald-400 tabular-nums shrink-0">
                    +{plan.returnPercent}%
                  </span>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
                  {plan.description}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-xs font-mono text-slate-300 tabular-nums">
                  <span>Min {plan.minAmount.toLocaleString()} Pts</span>
                  <span className="text-amber-300">
                    {plan.bonusFreeSpins > 0
                      ? `+${plan.bonusFreeSpins} Free ${plan.bonusFreeSpins === 1 ? 'Spin' : 'Spins'}`
                      : 'Instant Exit'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Projection Chart + Allocation Form */}
      <div className="grid gap-6 lg:grid-cols-12 items-stretch">
        {/* Interactive Yield Projection Chart */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-xl border border-white/10 bg-[#10221E] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Projected Return Curve
              </h2>
              <p className="text-xs text-slate-400">
                {selectedPlan
                  ? `${selectedPlan.name} · ${selectedPlan.termDays}-day linear yield forecast`
                  : 'Select a vault to inspect yield curve'}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400 tabular-nums">
                Day {activePoint.day} Value
              </p>
              <p className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                {activePoint.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} Pts
              </p>
            </div>
          </div>

          <div className="mt-4 w-full">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-48 overflow-visible"
              role="img"
              aria-label="Projected portfolio value curve"
              onMouseLeave={() => setHoverDay(null)}
            >
              <defs>
                <linearGradient id="investAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Principal Baseline */}
              <line
                x1={padX}
                y1={baselineY}
                x2={svgW - padX}
                y2={baselineY}
                stroke="rgba(255,255,255,0.18)"
                strokeDasharray="4 4"
                strokeWidth="1.25"
              />

              {/* Area + Yield Curve */}
              <path d={areaPath} fill="url(#investAreaGrad)" />
              <path
                d={linePath}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.75"
                strokeLinecap="round"
              />

              {/* Active Scrub Marker */}
              <line
                x1={toX(activePointIdx)}
                y1={padY}
                x2={toX(activePointIdx)}
                y2={svgH - padY}
                stroke="rgba(251, 191, 36, 0.45)"
                strokeWidth="1"
              />
              <circle
                cx={toX(activePointIdx)}
                cy={toY(activePoint.total)}
                r="5"
                fill="#FBBF24"
                stroke="#091311"
                strokeWidth="2"
              />

              {/* Interactive hover bands */}
              {chartSeries.map((pt, i) => {
                const bandW = (svgW - padX * 2) / pointsCount;
                return (
                  <rect
                    key={pt.day + '-' + i}
                    x={toX(i) - bandW / 2}
                    y={0}
                    width={bandW}
                    height={svgH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverDay(pt.day)}
                  />
                );
              })}
            </svg>

            <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
              <span>Day 0 ({chartBasePrincipal.toLocaleString()} Pts)</span>
              <span>Day {Math.round(termDays / 2)}</span>
              <span>
                Day {termDays} (
                {(chartBasePrincipal * (1 + chartMaxReturn / 100)).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}{' '}
                Pts)
              </span>
            </div>
          </div>
        </div>

        {/* Invest Allocation Form */}
        <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#10221E] p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Allocate to {selectedPlan?.name || 'Vault'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Invest from your points balance. Withdraw anytime to return principal plus accrued
              yield to your wallet.
            </p>

            <form onSubmit={handleDeposit} className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="invest-amount" className="font-medium text-slate-300">
                    Investment Amount (Points / KSh)
                  </label>
                  {player && (
                    <span className="font-mono text-slate-400 tabular-nums">
                      Balance: {player.points.toLocaleString()} Pts
                    </span>
                  )}
                </div>

                <input
                  id="invest-amount"
                  type="number"
                  min={selectedPlan?.minAmount ?? 50}
                  max={selectedPlan?.maxAmount ?? 100000}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3.5 py-2.5 font-mono text-sm text-white tabular-nums focus:border-amber-400 focus:outline-none"
                />

                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: '100', val: 100 },
                    { label: '250', val: 250 },
                    { label: '500', val: 500 },
                    ...(player && player.points >= (selectedPlan?.minAmount ?? 50)
                      ? [{ label: 'Max', val: player.points }]
                      : []),
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAmountInput(String(preset.val))}
                      className="rounded-md border border-white/15 bg-[#091311] px-3 py-1 font-mono text-xs text-slate-200 hover:border-amber-400/60 hover:text-amber-300"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Maturity Yield</span>
                  <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                    +{projectedYield.toLocaleString()} Pts ({selectedPlan?.returnPercent ?? 0}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Projected Maturity Value</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {projectedTotal.toLocaleString()} Pts
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Instant Bonus Spins</span>
                  <span className="font-mono font-semibold text-amber-300 tabular-nums">
                    +{selectedPlan?.bonusFreeSpins ?? 0} Spins
                  </span>
                </div>
              </div>

              {feedback && (
                <div
                  role="status"
                  className={`rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
                    feedback.type === 'ok'
                      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                      : 'border-red-500/35 bg-red-500/10 text-red-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-60 whitespace-nowrap"
              >
                {!player
                  ? 'Register / Sign In to Invest'
                  : submitting
                    ? 'Allocating...'
                    : `Invest ${parsedAmount.toLocaleString()} Pts`}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Positions Ledger Table */}
      <div className="rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Investment Positions Ledger
            </h2>
            <p className="text-xs text-slate-400">
              Track active vaults, accrued yield, and withdraw returns back to your Spin wallet.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-white/10 bg-[#091311] p-1 text-xs">
            {(['ALL', 'ACTIVE', 'CLAIMED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`rounded-md px-3 py-1 font-medium transition-colors whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : 'Claimed'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-xs text-slate-400">
            Loading portfolio ledger...
          </div>
        ) : !player ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-300">
              Sign in or register to view and manage your investment positions.
            </p>
            <button
              type="button"
              onClick={onGoAuth}
              className="mt-4 rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              Register / Sign In
            </button>
          </div>
        ) : filteredPositions.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-400">
            No investment positions found. Allocate points to any vault above to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-[#0B1916] text-slate-400">
                <tr>
                  <th className="px-6 py-3">Vault Plan</th>
                  <th className="px-6 py-3 text-right">Principal</th>
                  <th className="px-6 py-3 text-right">Target Yield</th>
                  <th className="px-6 py-3 text-right">Accrued</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredPositions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3.5">
                      <p className="font-semibold text-white">{pos.planName}</p>
                      <p className="font-mono text-[11px] text-slate-400 tabular-nums">
                        Started {new Date(pos.createdAt).toLocaleDateString()} · {pos.termDays}d
                      </p>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-white tabular-nums">
                      {pos.principal.toLocaleString()} Pts
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-slate-300 tabular-nums">
                      +{pos.returnPercent}%
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                      +{(pos.accruedYield ?? 0).toLocaleString()} Pts
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {pos.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
                          <Clock className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Claimed ({pos.payoutAmount.toLocaleString()} Pts)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      {pos.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={claimingId === pos.id}
                          onClick={() => void handleClaim(pos.id)}
                          className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          {claimingId === pos.id ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">Settled</span>
                      )}
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
