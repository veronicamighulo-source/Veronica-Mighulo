import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Smartphone,
  XCircle,
} from 'lucide-react';
import type {
  PaymentChannel,
  PublicPlayer,
  WalletOverviewResponse,
  WalletTransaction,
} from '../types/game';
import { apiRequest } from '../utils/api';

interface WalletCashierProps {
  player: PublicPlayer;
  onPlayerUpdated: (player: PublicPlayer) => void;
}

export const WalletCashier: React.FC<WalletCashierProps> = ({
  player,
  onPlayerUpdated,
}) => {
  const connectedPhone = player.linkedWalletPhone || player.phone;
  const [action, setAction] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [channel, setChannel] = useState<PaymentChannel>('MPESA_SAFARICOM');
  const [amountKsh, setAmountKsh] = useState<string>('100');
  const [mpesaPhone, setMpesaPhone] = useState<string>(connectedPhone);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState<string>(connectedPhone);
  const [connectingPhone, setConnectingPhone] = useState(false);
  const [banks, setBanks] = useState<string[]>([
    'Equity Bank Kenya',
    'KCB Bank Kenya',
    'Co-operative Bank of Kenya',
    'NCBA Bank Kenya',
    'Absa Bank Kenya',
    'I&M Bank Kenya',
    'Stanbic Bank Kenya',
  ]);
  const [bankName, setBankName] = useState<string>('Equity Bank Kenya');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>(player.name);
  const [mpesaMode, setMpesaMode] = useState<'DARAJA_LIVE' | 'SANDBOX'>('SANDBOX');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  useEffect(() => {
    const nextPhone = player.linkedWalletPhone || player.phone;
    setMpesaPhone(nextPhone);
    setPhoneDraft(nextPhone);
  }, [player.linkedWalletPhone, player.phone]);

  const loadWalletOverview = useCallback(async () => {
    try {
      const data = await apiRequest<WalletOverviewResponse>('/api/wallet/overview');
      setMpesaMode(data.mpesaMode);
      if (data.banks.length > 0) {
        setBanks(data.banks);
        if (!data.banks.includes(bankName)) {
          setBankName(data.banks[0]);
        }
      }
      setTransactions(data.transactions);
    } catch {
      // keep existing state on transient error
    }
  }, [bankName]);

  useEffect(() => {
    void loadWalletOverview();
  }, [loadWalletOverview]);

  const handleConnectPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setConnectingPhone(true);
    try {
      const res = await apiRequest<{
        player: PublicPlayer;
        connectedPhone: string;
        message: string;
      }>('/api/wallet/connect-phone', {
        method: 'POST',
        body: JSON.stringify({ phone: phoneDraft }),
      });
      onPlayerUpdated(res.player);
      setMpesaPhone(res.connectedPhone);
      setEditingPhone(false);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to connect phone number.',
      });
    } finally {
      setConnectingPhone(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      const endpoint =
        action === 'DEPOSIT' ? '/api/wallet/deposit' : '/api/wallet/withdraw';
      const payload =
        channel === 'MPESA_SAFARICOM'
          ? {
              channel,
              amountKsh: Number(amountKsh),
              phone: mpesaPhone.trim(),
            }
          : {
              channel,
              amountKsh: Number(amountKsh),
              bankName,
              accountNumber: accountNumber.trim(),
              accountName: accountName.trim() || player.name,
            };

      const res = await apiRequest<{
        player: PublicPlayer;
        transaction: WalletTransaction;
        message: string;
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onPlayerUpdated(res.player);
      setTransactions((prev) => [res.transaction, ...prev]);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Transaction failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connected Phone Number Wallet Connection Strip */}
      <div className="rounded-xl border border-emerald-500/25 bg-[#10221E] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-emerald-400">
                Phone Wallet Connected · Safaricom M-Pesa
              </p>
              <p className="mt-0.5 font-mono text-base font-bold text-white tabular-nums">
                {connectedPhone}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditingPhone((prev) => !prev)}
            className="rounded-lg border border-white/15 bg-[#091311] px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors hover:border-emerald-400/50 hover:text-white whitespace-nowrap"
          >
            {editingPhone ? 'Cancel' : 'Change Phone Number'}
          </button>
        </div>

        {editingPhone && (
          <form
            onSubmit={handleConnectPhone}
            className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-4"
          >
            <div className="min-w-[220px] flex-1">
              <label
                htmlFor="connect-wallet-phone"
                className="block text-xs font-medium text-slate-300"
              >
                New Safaricom M-Pesa Phone Number
              </label>
              <input
                id="connect-wallet-phone"
                type="tel"
                required
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                placeholder="0712 345 678 or 254712345678"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3.5 py-2 font-mono text-sm text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={connectingPhone}
              className="rounded-lg bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50 whitespace-nowrap"
            >
              {connectingPhone ? 'Connecting...' : 'Connect Phone'}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-[#10221E] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-medium text-emerald-400">
              Safaricom M-Pesa &amp; Bank Cashier ·{' '}
              {mpesaMode === 'DARAJA_LIVE' ? 'Daraja Live Gateway' : 'Sandbox Mode'}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-white">
              Deposit &amp; Withdraw (1 KSh = 1 Point)
            </h2>
          </div>

          <div className="inline-flex rounded-lg border border-white/10 bg-[#091311] p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setAction('DEPOSIT');
                setFeedback(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 font-semibold transition-colors whitespace-nowrap ${
                action === 'DEPOSIT'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Deposit
            </button>
            <button
              type="button"
              onClick={() => {
                setAction('WITHDRAW');
                setFeedback(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 font-semibold transition-colors whitespace-nowrap ${
                action === 'WITHDRAW'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Withdraw
            </button>
          </div>
        </div>

        {/* Channel Switcher */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setChannel('MPESA_SAFARICOM');
              setFeedback(null);
            }}
            className={`flex items-center gap-3 rounded-lg border p-3.5 text-left transition-colors ${
              channel === 'MPESA_SAFARICOM'
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-white/10 bg-[#091311] hover:border-white/25'
            }`}
          >
            <Smartphone className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">Safaricom M-Pesa</p>
              <p className="text-xs text-slate-400">
                {action === 'DEPOSIT'
                  ? 'Instant STK Push prompt · Min KSh 10'
                  : 'Direct M-Pesa payout · Min KSh 50'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setChannel('BANK_TRANSFER');
              setFeedback(null);
            }}
            className={`flex items-center gap-3 rounded-lg border p-3.5 text-left transition-colors ${
              channel === 'BANK_TRANSFER'
                ? 'border-amber-400 bg-amber-400/10'
                : 'border-white/10 bg-[#091311] hover:border-white/25'
            }`}
          >
            <Building2 className="h-5 w-5 text-amber-300 shrink-0" />
            <div>
              <p className="text-sm font-bold text-white">Kenyan Bank Transfer</p>
              <p className="text-xs text-slate-400">
                {action === 'DEPOSIT'
                  ? 'Equity, KCB, Co-op, NCBA & more · Min KSh 100'
                  : 'EFT / PesaLink bank payout · Min KSh 50'}
              </p>
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {channel === 'MPESA_SAFARICOM' ? (
            <div>
              <label
                htmlFor="mpesa-phone-input"
                className="block text-xs font-medium text-slate-300"
              >
                Safaricom M-Pesa Phone Number
              </label>
              <input
                id="mpesa-phone-input"
                type="tel"
                required
                value={mpesaPhone}
                onChange={(e) => setMpesaPhone(e.target.value)}
                placeholder="0712 345 678 or 254712345678"
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3.5 py-2.5 font-mono text-sm text-white focus:border-emerald-400 focus:outline-none"
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="bank-select"
                  className="block text-xs font-medium text-slate-300"
                >
                  Select Bank
                </label>
                <select
                  id="bank-select"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                >
                  {banks.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="bank-account-num"
                  className="block text-xs font-medium text-slate-300"
                >
                  Account Number
                </label>
                <input
                  id="bank-account-num"
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 014029384712"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2.5 font-mono text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="bank-account-name"
                  className="block text-xs font-medium text-slate-300"
                >
                  Account Holder Name
                </label>
                <input
                  id="bank-account-name"
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Full legal name"
                  className="mt-1.5 w-full rounded-lg border border-white/15 bg-[#091311] px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="cashier-amount" className="font-medium text-slate-300">
                Amount (KSh)
              </label>
              <span className="font-mono text-slate-400 tabular-nums">
                Available: {player.points.toLocaleString()} KSh / Pts
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <input
                id="cashier-amount"
                type="number"
                required
                min={action === 'WITHDRAW' ? 50 : channel === 'BANK_TRANSFER' ? 100 : 10}
                value={amountKsh}
                onChange={(e) => setAmountKsh(e.target.value)}
                className="min-w-[140px] flex-1 rounded-lg border border-white/15 bg-[#091311] px-3.5 py-2.5 font-mono text-sm text-white tabular-nums focus:border-amber-400 focus:outline-none"
              />
              {[50, 100, 500, 1000, 2500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountKsh(String(preset))}
                  className="rounded-lg border border-white/15 bg-[#091311] px-3 py-2 font-mono text-xs text-slate-200 hover:border-amber-400/60 hover:text-amber-300 tabular-nums"
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {feedback && (
            <div
              role="status"
              className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
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
            className={`w-full rounded-lg px-5 py-3 text-sm font-bold text-slate-950 transition-colors disabled:opacity-50 whitespace-nowrap ${
              action === 'DEPOSIT'
                ? 'bg-emerald-400 hover:bg-emerald-300'
                : 'bg-amber-400 hover:bg-amber-300'
            }`}
          >
            {submitting
              ? 'Processing...'
              : action === 'DEPOSIT'
                ? channel === 'MPESA_SAFARICOM'
                  ? `Send M-Pesa STK Push (KSh ${Number(amountKsh || 0).toLocaleString()})`
                  : `Confirm Bank Deposit (KSh ${Number(amountKsh || 0).toLocaleString()})`
                : channel === 'MPESA_SAFARICOM'
                  ? `Withdraw KSh ${Number(amountKsh || 0).toLocaleString()} to M-Pesa`
                  : `Withdraw KSh ${Number(amountKsh || 0).toLocaleString()} to Bank`}
          </button>
        </form>
      </div>

      {/* Wallet Transactions Ledger */}
      <div className="rounded-xl border border-white/10 bg-[#10221E] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              M-Pesa &amp; Bank Transactions
            </h3>
            <p className="text-xs text-slate-400">
              Verified receipts and payout references for deposits and withdrawals.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-300 tabular-nums">
            {transactions.length} {transactions.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="px-6 py-8 text-center text-xs text-slate-400">
            No deposits or withdrawals recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-[#0B1916] text-slate-400">
                <tr>
                  <th className="px-6 py-3">Date &amp; Time</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Channel &amp; Account</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02]">
                    <td className="px-6 py-3 font-mono text-slate-300 whitespace-nowrap tabular-nums">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-white whitespace-nowrap">
                      {tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}
                    </td>
                    <td className="px-6 py-3 text-slate-200 whitespace-nowrap">
                      {tx.channel === 'MPESA_SAFARICOM'
                        ? `Safaricom M-Pesa · ${tx.phoneOrAccount}`
                        : `${tx.bankName || 'Bank'} · ${tx.phoneOrAccount}`}
                    </td>
                    <td className="px-6 py-3 font-mono text-slate-300 whitespace-nowrap">
                      {tx.referenceCode}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {tx.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed
                        </span>
                      ) : tx.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1.5 text-amber-300 font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          Pending PIN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-300 font-medium">
                          <XCircle className="h-3.5 w-3.5" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-6 py-3 text-right font-mono font-bold whitespace-nowrap tabular-nums ${
                        tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-amber-300'
                      }`}
                    >
                      {tx.type === 'DEPOSIT' ? '+' : '-'}KSh{' '}
                      {tx.amountKsh.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
