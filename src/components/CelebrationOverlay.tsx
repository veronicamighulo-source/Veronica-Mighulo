import React, { useEffect, useRef } from 'react';
import { ShieldCheck, Sparkles, Trophy, X } from 'lucide-react';
import type { SpinRecord } from '../types/game';

interface CelebrationOverlayProps {
  spin: SpinRecord | null;
  onClose: () => void;
  onSpinAgain: () => void;
  onRegisterToClaim?: () => void;
  onInspectFairness: (spin: SpinRecord) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  life: number;
}

export const CelebrationOverlay: React.FC<CelebrationOverlayProps> = ({
  spin,
  onClose,
  onSpinAgain,
  onRegisterToClaim,
  onInspectFairness,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isWin = spin && spin.prizeType !== 'TRY_AGAIN';
  const isJackpot = spin?.prizeType === 'JACKPOT';

  useEffect(() => {
    if (!spin || !isWin) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = isJackpot
      ? ['#FBBF24', '#F59E0B', '#FEF08A', '#10B981', '#FFFFFF']
      : ['#10B981', '#FBBF24', '#38BDF8', '#F43F5E', '#A78BFA'];

    const count = isJackpot ? 160 : 95;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: canvas.width * (0.25 + Math.random() * 0.5),
      y: canvas.height * 0.42,
      vx: (Math.random() - 0.5) * (isJackpot ? 16 : 12),
      vy: -Math.random() * (isJackpot ? 15 : 11) - 4,
      size: 6 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      life: 1,
    }));

    let rafId = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.34;
        p.vx *= 0.99;
        p.rotation += p.vRot;
        p.life -= 0.008;
        if (p.life > 0 && p.y < canvas.height + 40) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.65);
          ctx.restore();
        }
      }
      if (alive) {
        rafId = requestAnimationFrame(render);
      }
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [spin, isWin, isJackpot]);

  if (!spin) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spin-result-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      {isWin && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-0"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 w-full max-w-md rounded-xl border border-amber-400/30 bg-[#10221E] p-6 sm:p-7 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close result dialog"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          {isJackpot ? (
            <img
              src="/src/assets/images/jackpot_trophy_emblem_1794821893536.jpg"
              alt="Jackpot Trophy"
              referrerPolicy="no-referrer"
              className="mb-4 h-24 w-24 rounded-xl border border-amber-400/40 object-cover shadow-lg"
            />
          ) : (
            <div
              className={`mb-4 flex h-16 w-16 items-center justify-center rounded-xl border ${
                isWin
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-600 bg-slate-800/80 text-slate-300'
              }`}
            >
              {spin.prizeType === 'BONUS_SPIN' ? (
                <Sparkles className="h-8 w-8" />
              ) : (
                <Trophy className="h-8 w-8" />
              )}
            </div>
          )}

          <p className="text-xs font-medium text-amber-300/90">
            {isJackpot
              ? 'Grand Jackpot Winner'
              : spin.prizeType === 'CASH_KSH'
                ? 'Prize Credited'
                : spin.prizeType === 'BONUS_SPIN'
                  ? 'Free Spin Unlocked'
                  : 'Spin Complete'}
          </p>

          <h2
            id="spin-result-title"
            className="mt-1 font-display text-3xl font-extrabold text-white"
          >
            {spin.prizeLabel}
          </h2>

          <p className="mt-2 text-sm text-slate-300 max-w-sm">
            {spin.isDemo
              ? `Practice spin landed on ${spin.prizeLabel}. Register with your name and phone number to play with real points and save winnings.`
              : (
                <>
                  {spin.prizeType === 'JACKPOT' &&
                    `Incredible! KSh ${spin.prizeValue.toLocaleString()} has been added to your available balance.`}
                  {spin.prizeType === 'CASH_KSH' &&
                    `You won KSh ${spin.prizeValue.toLocaleString()}. Your balance has been updated immediately.`}
                  {spin.prizeType === 'BONUS_SPIN' &&
                    `You earned +${spin.prizeValue} Bonus Spin. Spin again right away at zero point cost.`}
                  {spin.prizeType === 'TRY_AGAIN' &&
                    'No prize on this spin — every round uses transparent random odds. Try another spin!'}
                </>
              )}
          </p>

          <div className="mt-5 w-full rounded-lg border border-white/10 bg-[#0A1714] px-4 py-3 text-left text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span>Provably Fair Proof</span>
              <span className="font-mono tabular-nums text-emerald-400">
                Roll {spin.fairness.roll} / {spin.fairness.totalWeight}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-slate-300">
              SHA-256: {spin.fairness.proofHash}
            </p>
            <button
              type="button"
              onClick={() => onInspectFairness(spin)}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Verify this spin independently
            </button>
          </div>

          <div className="mt-6 flex w-full gap-3">
            <button
              type="button"
              onClick={spin.isDemo && onRegisterToClaim ? onRegisterToClaim : onClose}
              className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap"
            >
              {spin.isDemo ? 'Register to Claim' : 'View Balance'}
            </button>
            <button
              type="button"
              onClick={onSpinAgain}
              className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
            >
              Spin Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
