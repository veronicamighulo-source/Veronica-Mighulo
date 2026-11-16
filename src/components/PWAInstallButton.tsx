import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'toolbar' | 'footer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'toolbar',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          variant === 'footer'
            ? 'inline-flex items-center gap-1.5 text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/25 whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-3.5 w-3.5" />
        Install App
      </button>

      {showGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-sm rounded-xl border border-amber-400/30 bg-[#10221E] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Close install instructions"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300 shrink-0">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h2 id="install-guide-title" className="font-display text-lg font-bold text-white">
                  Install SPIN GAMBO LIN
                </h2>
                <p className="text-xs text-slate-400">Add to your phone or desktop</p>
              </div>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2 text-sm text-slate-200 list-decimal list-inside">
                <li>
                  Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> to launch SPIN GAMBO LIN as a standalone app.
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2 text-sm text-slate-200 list-decimal list-inside">
                <li>
                  Open this app directly in <strong>Chrome</strong> or <strong>Edge</strong> (outside
                  an embedded preview).
                </li>
                <li>
                  Tap the browser menu (<strong>⋮</strong>) or address-bar install icon.
                </li>
                <li>
                  Select <strong>Install SPIN GAMBO LIN</strong> / <strong>Add to Home Screen</strong>.
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full rounded-lg bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-300"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-[#10221E] px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg"
    >
      <WifiOff className="h-4 w-4 text-amber-300 shrink-0" />
      Offline Mode — Cached view active
    </div>
  );
};
