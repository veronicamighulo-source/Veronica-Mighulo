import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import type { PrizeSegment, SpinRecord } from '../types/game';
import { verifyFairnessProof, type FairnessVerificationResult } from '../utils/fairness';

interface FairnessViewProps {
  prizes: PrizeSegment[];
  inspectedSpin: SpinRecord | null;
}

export const FairnessView: React.FC<FairnessViewProps> = ({ prizes, inspectedSpin }) => {
  const [selectedSpin, setSelectedSpin] = useState<SpinRecord | null>(inspectedSpin);
  const [serverSeed, setServerSeed] = useState(inspectedSpin?.fairness.serverSeed || '');
  const [clientSeed, setClientSeed] = useState(inspectedSpin?.fairness.clientSeed || '');
  const [nonce, setNonce] = useState(
    inspectedSpin ? String(inspectedSpin.fairness.nonce) : ''
  );
  const [verification, setVerification] = useState<FairnessVerificationResult | null>(null);

  useEffect(() => {
    if (inspectedSpin) {
      setSelectedSpin(inspectedSpin);
      setServerSeed(inspectedSpin.fairness.serverSeed);
      setClientSeed(inspectedSpin.fairness.clientSeed);
      setNonce(String(inspectedSpin.fairness.nonce));
      void verifyFairnessProof(inspectedSpin.fairness).then(setVerification);
    }
  }, [inspectedSpin]);

  const totalWeight = prizes.reduce((acc, p) => acc + Math.max(0, p.weight), 0);

  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverSeed || !clientSeed || !nonce) return;

    const proof = selectedSpin
      ? {
          ...selectedSpin.fairness,
          serverSeed: serverSeed.trim(),
          clientSeed: clientSeed.trim(),
          nonce: Number(nonce),
        }
      : {
          serverSeed: serverSeed.trim(),
          clientSeed: clientSeed.trim(),
          nonce: Number(nonce),
          proofHash: '',
          roll: 0,
          totalWeight,
          activeWeightsSnapshot: prizes.map((p) => ({
            id: p.id,
            label: p.label,
            weight: p.weight,
          })),
        };

    const result = await verifyFairnessProof(proof);
    setVerification(result);
  };

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 space-y-8">
      <div className="rounded-xl border border-amber-500/20 bg-[#10221E] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-6 w-6 text-emerald-400 shrink-0" />
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              Transparent Random Selection &amp; Odds
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              SPIN GAMBO LIN uses server-side cryptographic randomness with zero guaranteed
              winnings. Every spin combines a freshly generated 256-bit{' '}
              <code className="font-mono text-amber-300">serverSeed</code>, your{' '}
              <code className="font-mono text-amber-300">clientSeed</code>, and an incrementing{' '}
              <code className="font-mono text-amber-300">nonce</code> hashed via SHA-256 to pick a
              weighted roll deterministically.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Transparent Live Odds Table */}
        <div className="lg:col-span-6 rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
          <div className="border-b border-white/10 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-white">
              Published Wheel Probabilities
            </h2>
            <p className="text-xs text-slate-400">
              Live weights synchronized directly from the game server.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#0B1916] text-xs font-medium text-slate-400">
              <tr>
                <th className="px-6 py-3">Prize Segment</th>
                <th className="px-6 py-3 text-right">Weight</th>
                <th className="px-6 py-3 text-right">Exact Odds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {prizes.map((prize) => {
                const pct = totalWeight > 0 ? ((prize.weight / totalWeight) * 100).toFixed(2) : '0.00';
                return (
                  <tr key={prize.id}>
                    <td className="px-6 py-3 font-medium text-white">
                      <span className="inline-flex items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 rounded-sm shrink-0"
                          style={{ backgroundColor: prize.color }}
                        />
                        {prize.label}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs text-slate-300 tabular-nums">
                      {prize.weight}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs font-semibold text-amber-300 tabular-nums">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#0B1916] font-semibold">
                <td className="px-6 py-3 text-xs text-slate-300">Total Active Pool</td>
                <td className="px-6 py-3 text-right font-mono text-xs text-slate-200 tabular-nums">
                  {totalWeight}
                </td>
                <td className="px-6 py-3 text-right font-mono text-xs text-emerald-400 tabular-nums">
                  100.00%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Independent SHA-256 Spin Verifier */}
        <div className="lg:col-span-6 rounded-xl border border-white/10 bg-[#10221E] p-6">
          <h2 className="font-display text-lg font-bold text-white">
            Independent SHA-256 Spin Verifier
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Select &ldquo;Verify&rdquo; on any spin in your History or paste the spin proof inputs
            below to verify the outcome locally in your browser.
          </p>

          <form onSubmit={handleManualVerify} className="mt-5 space-y-4">
            <div>
              <label htmlFor="vf-server-seed" className="block text-xs font-medium text-slate-300">
                Server Seed (Hex)
              </label>
              <input
                id="vf-server-seed"
                type="text"
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                placeholder="Paste serverSeed from spin record"
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="vf-client-seed" className="block text-xs font-medium text-slate-300">
                  Client Seed
                </label>
                <input
                  id="vf-client-seed"
                  type="text"
                  value={clientSeed}
                  onChange={(e) => setClientSeed(e.target.value)}
                  placeholder="clientSeed"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="vf-nonce" className="block text-xs font-medium text-slate-300">
                  Spin Nonce
                </label>
                <input
                  id="vf-nonce"
                  type="number"
                  value={nonce}
                  onChange={(e) => setNonce(e.target.value)}
                  placeholder="e.g. 1001"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-xs text-white tabular-nums focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300"
            >
              Compute SHA-256 &amp; Verify Roll
            </button>
          </form>

          {verification && (
            <div className="mt-5 rounded-lg border border-white/10 bg-[#091311] p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                {selectedSpin ? (
                  verification.valid ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-300">
                        Verified Match — Outcome matches SHA-256 proof
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-400" />
                      <span className="text-red-300">
                        {verification.reason || 'Inputs differ from recorded proof'}
                      </span>
                    </>
                  )
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-amber-300" />
                    <span className="text-amber-300">Deterministic Result Computed</span>
                  </>
                )}
              </div>
              <p className="font-mono text-[11px] text-slate-400 break-all">
                Hash: {verification.computedHash}
              </p>
              <div className="flex items-center justify-between pt-1 text-slate-300">
                <span>
                  Computed Roll:{' '}
                  <strong className="font-mono tabular-nums text-white">
                    {verification.computedRoll}
                  </strong>
                </span>
                <span>
                  Winning Slice:{' '}
                  <strong className="text-amber-300">{verification.selectedLabel}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
