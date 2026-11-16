import React, { useEffect, useRef, useState } from 'react';
import { animate, useMotionValue } from 'motion/react';
import type { PrizeSegment } from '../types/game';
import { soundEngine } from '../utils/soundEngine';

interface SpinWheelProps {
  prizes: PrizeSegment[];
  spinning: boolean;
  targetIndex: number | null;
  spinTriggerId: number;
  canSpin: boolean;
  spinButtonSubtext: string;
  onRequestSpin: () => void;
  onSpinComplete: () => void;
}

export const SpinWheel: React.FC<SpinWheelProps> = ({
  prizes,
  spinning,
  targetIndex,
  spinTriggerId,
  canSpin,
  spinButtonSubtext,
  onRequestSpin,
  onSpinComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationMv = useMotionValue(0);
  const pointerMv = useMotionValue(0);
  const pointerAnimRef = useRef<ReturnType<typeof animate> | null>(null);
  const lastPegIndexRef = useRef<number>(-1);
  const bulbPhaseRef = useRef<number>(0);
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const [isAnimating, setIsAnimating] = useState(false);
  const [countdownText, setCountdownText] = useState<string>('0.0s');
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const ringCircleRef = useRef<SVGCircleElement | null>(null);
  const lastTenthRef = useRef<number>(-1);

  // Draw wheel on canvas
  const drawWheel = (angle: number, pointerKick: number, bulbPhase: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = canvas.clientWidth;
    if (displaySize === 0) return;

    if (canvas.width !== displaySize * dpr || canvas.height !== displaySize * dpr) {
      canvas.width = displaySize * dpr;
      canvas.height = displaySize * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize, displaySize);

    const cx = displaySize / 2;
    const cy = displaySize / 2;
    const outerRadius = displaySize / 2 - 10;
    const rimWidth = Math.max(16, outerRadius * 0.085);
    const wheelRadius = outerRadius - rimWidth;

    // Outer ambient shadow ring
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    const rimGrad = ctx.createRadialGradient(
      cx,
      cy,
      wheelRadius,
      cx,
      cy,
      outerRadius + 4
    );
    rimGrad.addColorStop(0, '#92400E');
    rimGrad.addColorStop(0.45, '#F59E0B');
    rimGrad.addColorStop(0.85, '#B45309');
    rimGrad.addColorStop(1, '#451A03');
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Inner bevel stroke
    ctx.beginPath();
    ctx.arc(cx, cy, wheelRadius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 251, 235, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const count = prizes.length;
    if (count === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, wheelRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0F3D32';
      ctx.fill();
    } else {
      const sliceAngle = (Math.PI * 2) / count;

      // Draw slices
      for (let i = 0; i < count; i++) {
        const prize = prizes[i];
        if (!prize) continue;
        const start = angle + i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
        const end = start + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, wheelRadius, start, end);
        ctx.closePath();

        const sliceGrad = ctx.createRadialGradient(cx, cy, 28, cx, cy, wheelRadius);
        sliceGrad.addColorStop(0, prize.color);
        sliceGrad.addColorStop(1, prize.color);
        ctx.fillStyle = sliceGrad;
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1.75;
        ctx.stroke();

        // Label text along the slice centerline
        ctx.save();
        ctx.translate(cx, cy);
        const midAngle = start + sliceAngle / 2;
        ctx.rotate(midAngle);

        const fontSize = Math.max(11, Math.min(16, wheelRadius * 0.082));
        ctx.font = `700 ${fontSize}px "Outfit", system-ui, sans-serif`;
        ctx.fillStyle = prize.textColor || '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 4;

        const textRadius = wheelRadius - 18;
        const label = prize.label.length > 14 ? `${prize.label.slice(0, 13)}…` : prize.label;
        ctx.fillText(label, textRadius, 0);

        if (prize.type === 'JACKPOT') {
          ctx.font = `600 ${Math.max(9, fontSize * 0.65)}px "JetBrains Mono", monospace`;
          ctx.fillStyle = '#FEF08A';
          ctx.fillText(`KSh ${prize.value.toLocaleString()}`, textRadius, fontSize * 0.95);
        }
        ctx.restore();
      }

      // Metallic pegs around rim boundary
      for (let i = 0; i < count; i++) {
        const pegAngle = angle + i * sliceAngle - Math.PI / 2 - sliceAngle / 2;
        const px = cx + Math.cos(pegAngle) * (wheelRadius - 2);
        const py = cy + Math.sin(pegAngle) * (wheelRadius - 2);
        ctx.beginPath();
        ctx.arc(px, py, 4.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FEF3C7';
        ctx.fill();
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // Marquee bulbs on outer gold bezel
    const bulbCount = 24;
    const bulbRadius = wheelRadius + rimWidth * 0.5;
    for (let b = 0; b < bulbCount; b++) {
      const bAngle = (b / bulbCount) * Math.PI * 2 - Math.PI / 2;
      const bx = cx + Math.cos(bAngle) * bulbRadius;
      const by = cy + Math.sin(bAngle) * bulbRadius;
      const isLit = (b + Math.floor(bulbPhase)) % 2 === 0;

      ctx.beginPath();
      ctx.arc(bx, by, isLit ? 3.8 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = isLit ? '#FEF9C3' : 'rgba(69, 26, 3, 0.7)';
      if (isLit) {
        ctx.shadowColor = '#FDE047';
        ctx.shadowBlur = 8;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Top Center Pointer / Flapper (at 12 o'clock)
    ctx.save();
    ctx.translate(cx, cy - outerRadius + 6);
    ctx.rotate(pointerKick);
    ctx.beginPath();
    ctx.moveTo(0, 28);
    ctx.lineTo(-14, -6);
    ctx.quadraticCurveTo(0, -14, 14, -6);
    ctx.closePath();
    const ptrGrad = ctx.createLinearGradient(0, -10, 0, 28);
    ptrGrad.addColorStop(0, '#FEF08A');
    ptrGrad.addColorStop(0.5, '#F59E0B');
    ptrGrad.addColorStop(1, '#B45309');
    ctx.fillStyle = ptrGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  };

  // Ambient marquee bulb animation when idle & continuous canvas sync during motion
  useEffect(() => {
    let rafId = 0;
    let lastBulbTime = performance.now();

    const tickRender = (now: number) => {
      if (!isAnimating) {
        if (now - lastBulbTime > 420) {
          bulbPhaseRef.current = (bulbPhaseRef.current + 1) % 2;
          lastBulbTime = now;
        }
      }
      drawWheel(rotationMv.get(), pointerMv.get(), bulbPhaseRef.current);
      rafId = requestAnimationFrame(tickRender);
    };

    rafId = requestAnimationFrame(tickRender);
    return () => cancelAnimationFrame(rafId);
  });

  // Trigger physical momentum spin + spring peg settle using motion/react
  useEffect(() => {
    if (spinTriggerId === 0 || targetIndex === null || prizes.length === 0) {
      return;
    }

    let cancelled = false;
    const count = prizes.length;
    const sliceAngle = (Math.PI * 2) / count;
    const startAngle = rotationMv.get();

    // Normalize desired landing angle so targetIndex centers at 12 o'clock
    const baseTargetMod =
      (Math.PI * 2 - ((targetIndex * sliceAngle) % (Math.PI * 2))) % (Math.PI * 2);
    const jitter = (Math.random() - 0.5) * sliceAngle * 0.42;
    const currentMod = ((startAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    let deltaToTarget = baseTargetMod + jitter - currentMod;
    if (deltaToTarget < 0) {
      deltaToTarget += Math.PI * 2;
    }

    const fullRotations = 6 * Math.PI * 2;
    const totalDelta = fullRotations + deltaToTarget;
    const finalAngle = startAngle + totalDelta;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const coastDurationSec = prefersReduced ? 0.55 : 4.2;
    const settleBufferSec = prefersReduced ? 0.05 : 0.7;
    const totalDurationMs = (coastDurationSec + settleBufferSec) * 1000;
    const overshootOffset = prefersReduced ? 0 : Math.min(0.06, sliceAngle * 0.09);

    setIsAnimating(true);
    lastTenthRef.current = -1;
    soundEngine.playSpinStart();

    const ringCircumference = 2 * Math.PI * 58;
    const startTime = performance.now();
    lastPegIndexRef.current = Math.floor((startAngle + sliceAngle / 2) / sliceAngle);

    const handleAngleUpdate = (latestAngle: number) => {
      const elapsed = performance.now() - startTime;
      const timeProgress = Math.min(1, elapsed / totalDurationMs);

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${timeProgress})`;
      }
      if (ringCircleRef.current) {
        ringCircleRef.current.style.strokeDashoffset = String(
          ringCircumference * (1 - timeProgress)
        );
      }

      const remainingTenths = Math.max(
        0,
        Math.ceil((totalDurationMs - elapsed) / 100)
      );
      if (remainingTenths !== lastTenthRef.current) {
        lastTenthRef.current = remainingTenths;
        setCountdownText(`${(remainingTenths / 10).toFixed(1)}s`);
      }

      // Detect peg crossing to trigger audio tick + physical spring flapper kick
      const pegIndex = Math.floor((latestAngle + sliceAngle / 2) / sliceAngle);
      if (pegIndex !== lastPegIndexRef.current) {
        lastPegIndexRef.current = pegIndex;
        const speedEstimate = Math.max(0.12, 1 - timeProgress);
        soundEngine.playPegTick(speedEstimate);

        if (pointerAnimRef.current) {
          pointerAnimRef.current.stop();
        }
        pointerMv.set(-0.38 * Math.min(1, speedEstimate + 0.22));
        pointerAnimRef.current = animate(pointerMv, 0, {
          type: 'spring',
          stiffness: 460,
          damping: 14,
          mass: 0.45,
        });
      }

      bulbPhaseRef.current += 0.16 * Math.max(0.15, 1 - timeProgress);
    };

    // Stage 1: High-inertia launch & organic bearing friction deceleration
    const coastControls = animate(rotationMv, finalAngle + overshootOffset, {
      duration: coastDurationSec,
      ease: [0.08, 0.88, 0.16, 1.0],
      onUpdate: handleAngleUpdate,
    });

    let settleControls: ReturnType<typeof animate> | null = null;

    void coastControls.then(() => {
      if (cancelled) return;

      // Stage 2: Physical peg resistance & spring equilibrium settle onto finalAngle
      settleControls = animate(rotationMv, finalAngle, {
        type: 'spring',
        stiffness: 120,
        damping: 11,
        mass: 1.15,
        restDelta: 0.0004,
        restSpeed: 0.0004,
        onUpdate: handleAngleUpdate,
      });

      void settleControls.then(() => {
        if (cancelled) return;
        if (progressBarRef.current) {
          progressBarRef.current.style.transform = 'scaleX(1)';
        }
        if (ringCircleRef.current) {
          ringCircleRef.current.style.strokeDashoffset = '0';
        }
        pointerMv.set(0);
        setIsAnimating(false);
        setCountdownText('0.0s');
        onSpinCompleteRef.current();
      });
    });

    return () => {
      cancelled = true;
      coastControls.stop();
      settleControls?.stop();
      pointerAnimRef.current?.stop();
    };
  }, [spinTriggerId, targetIndex, prizes, rotationMv, pointerMv]);

  const busy = spinning || isAnimating;
  const ringCircumference = 2 * Math.PI * 58;

  return (
    <div className="w-full max-w-[460px] mx-auto select-none">
      <div className="relative flex aspect-square w-full items-center justify-center">
        {/* Subtle halo behind wheel */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-4 rounded-full bg-amber-500/15 blur-2xl"
        />

        <canvas
          ref={canvasRef}
          className="relative z-10 h-full w-full"
          aria-label="Spin Gambo Lin Prize Wheel"
        />

        {/* Circular anticipation progress ring around the center hub */}
        <svg
          aria-hidden="true"
          viewBox="0 0 128 128"
          className={`pointer-events-none absolute z-20 h-28 w-28 sm:h-32 sm:w-32 -rotate-90 transition-opacity duration-200 ${
            isAnimating ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <circle
            cx="64"
            cy="64"
            r="58"
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="4"
          />
          <circle
            ref={ringCircleRef}
            cx="64"
            cy="64"
            r="58"
            fill="none"
            stroke="#10B981"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={ringCircumference}
            strokeDashoffset={ringCircumference}
          />
        </svg>

        {/* Large Glowing Center SPIN Button */}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            soundEngine.playClick();
            onRequestSpin();
          }}
          aria-label="Spin the wheel"
          className={`spin-btn-glow absolute z-20 flex h-24 w-24 sm:h-28 sm:w-28 flex-col items-center justify-center rounded-full border-4 border-amber-100/80 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 text-slate-950 shadow-xl transition-transform duration-150 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-amber-300 ${
            busy
              ? 'cursor-wait scale-95 opacity-95'
              : canSpin
                ? 'cursor-pointer hover:scale-105 active:scale-95'
                : 'cursor-pointer hover:scale-105 active:scale-95'
          }`}
        >
          <span className="font-display text-xl sm:text-2xl font-extrabold tracking-wide leading-none tabular-nums">
            {isAnimating ? countdownText : spinning ? '...' : 'SPIN'}
          </span>
          <span className="mt-1 text-[10px] font-bold tracking-tight text-slate-900/85 whitespace-nowrap">
            {isAnimating ? 'Landing' : spinning ? 'Starting' : spinButtonSubtext}
          </span>
        </button>
      </div>

      {/* Anticipation progress bar & countdown timer */}
      <div
        aria-live="polite"
        className={`mt-3 rounded-lg border border-amber-500/20 bg-[#10221E]/95 px-4 py-2.5 transition-opacity duration-200 ${
          busy ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-200">
            {isAnimating ? 'Revealing prize outcome...' : 'Securing random roll...'}
          </span>
          <span className="font-mono font-semibold text-amber-300 tabular-nums">
            {isAnimating ? countdownText : '4.9s'}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            ref={progressBarRef}
            className="h-full w-full origin-left bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>
      </div>
    </div>
  );
};
