import React from 'react';
import type { PublicPlayer } from '../types/game';

export type ActiveTab = 'play' | 'invest' | 'auth' | 'history' | 'fairness' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  player: PublicPlayer | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab, player }) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'play', label: 'Play Wheel' },
    { id: 'invest', label: 'Invest' },
    { id: 'history', label: 'Wallet' },
    { id: 'fairness', label: 'Fairness' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#091311]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-8 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectTab('play')}
          className="font-display text-lg font-extrabold tracking-tight text-amber-300 transition-colors hover:text-amber-200 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          SPIN GAMBO LIN
        </button>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-400 ${
                  active
                    ? 'text-amber-300'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-amber-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          {player ? (
            <button
              type="button"
              onClick={() => onSelectTab('history')}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              {player.points.toLocaleString()} Pts · {player.freeSpins} Free
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectTab('auth')}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              Register &amp; Play
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile Navigation"
        className="flex md:hidden items-center justify-between border-t border-white/5 px-3 py-1.5 text-xs font-medium overflow-x-auto"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-amber-400/15 text-amber-300'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
