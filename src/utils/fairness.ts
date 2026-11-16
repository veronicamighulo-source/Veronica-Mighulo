import type { FairnessProof } from '../types/game';

export interface FairnessVerificationResult {
  valid: boolean;
  computedHash: string;
  computedRoll: number;
  selectedLabel: string;
  reason?: string;
}

export async function verifyFairnessProof(
  proof: FairnessProof
): Promise<FairnessVerificationResult> {
  const input = `${proof.serverSeed}:${proof.clientSeed}:${proof.nonce}`;
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(digest));
  const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const totalWeight = proof.activeWeightsSnapshot.reduce(
    (sum, item) => sum + Math.max(0, Math.round(item.weight)),
    0
  );

  if (totalWeight <= 0) {
    return {
      valid: false,
      computedHash,
      computedRoll: -1,
      selectedLabel: 'Unknown',
      reason: 'Total weight must be greater than zero.',
    };
  }

  const rollSeedInt = parseInt(computedHash.slice(0, 8), 16);
  const computedRoll = rollSeedInt % totalWeight;

  let cumulative = 0;
  let selectedLabel = proof.activeWeightsSnapshot[0]?.label || 'Unknown';
  for (const item of proof.activeWeightsSnapshot) {
    cumulative += Math.max(0, Math.round(item.weight));
    if (computedRoll < cumulative) {
      selectedLabel = item.label;
      break;
    }
  }

  const valid =
    computedHash === proof.proofHash &&
    computedRoll === proof.roll &&
    totalWeight === proof.totalWeight;

  return {
    valid,
    computedHash,
    computedRoll,
    selectedLabel,
    reason: valid ? undefined : 'Hash or roll mismatch against recorded proof.',
  };
}
