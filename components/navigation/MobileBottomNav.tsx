'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION_CONFIG, NAVIGATION_STRUCTURE } from './NavigationConfig';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  ReceiptText,
  Users,
  Building2,
  ClipboardList,
  Package,
  WalletCards,
  Activity,
  Bell,
  ShieldCheck,
  FileClock,
  Settings2,
  MoreHorizontal,
  Grid,
  ChevronUp,
  ChevronDown,
  X,
  Badge,
  Search,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

interface MobileBottomNavProps {
  className?: string;
}

const ICON_MAP: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard,
  FileText,
  CreditCard,
  ReceiptText,
  Users,
  Building2,
  ClipboardList,
  Package,
  WalletCards,
  Activity,
  Bell,
  ShieldCheck,
  FileClock,
  Settings2,
};

function getBadgeCount(pathname: string, data: any): number | null {
  return null;
}

export function MobileBottomNav({
  className,
  badgeCounts = {},
}: MobileBottomNavProps & { badgeCounts?: Record<string, number> }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const primaryItems = NAVIGATION_CONFIG.filter((n) => n.mobilePriority === 'primary');
  const moreItems = NAVIGATION_CONFIG.filter((n) => n.mobilePriority !== 'primary');

  // Close menus on route change
  useEffect(() => {
    setIsMoreOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Close more menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSection = NAVIGATION_CONFIG.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + '/'),
  );

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-white border-t border-jt-border',
          'safe-area-inset-bottom',
          'transition-transform duration-200 ease-out',
          className,
        )}
        role="navigation"
        aria-label="Primary navigation"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {primaryItems.map((item) => {
            const isActive = currentSection?.id === item.id;
            const badgeCount = badgeCounts[item.id];
            const Icon = ICON_MAP[item.icon.name];

            return (
              <button
                key={item.id}
                onClick={() => router.push(item.href)}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1',
                  'flex-1 min-w-0 py-1.5 px-2',
                  'rounded-xl transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  isActive
                    ? 'text-jt-teal bg-jt-teal/5'
                    : 'text-jt-muted hover:text-jt-text hover:bg-jt-surface',
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
              >
                <div className="relative flex items-center justify-center">
                  <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                  {badgeCount && badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1.5">
                      <span className="inline-flex items-center justify-center px-2 h-4 text-[10px] font-semibold rounded-full bg-jt-teal text-white">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium truncate leading-none">{item.label}</span>
              </button>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1',
              'flex-1 min-w-0 py-1.5 px-2',
              'rounded-xl transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              isMoreOpen
                ? 'text-jt-teal bg-jt-teal/5'
                : 'text-jt-muted hover:text-jt-text hover:bg-jt-surface',
            )}
            aria-expanded={isMoreOpen}
            aria-haspopup="true"
            aria-label="More navigation options"
          >
            <div className="relative flex items-center justify-center">
              <MoreHorizontal size={24} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <span className="text-[10px] font-medium truncate leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsMoreOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={moreMenuRef}
              className="fixed bottom-16 left-0 right-0 z-50 max-h-[60vh] overflow-y-auto"
            >
              <div className="bg-white border-t border-jt-border rounded-t-2xl shadow-xl safe-area-inset-bottom">
                <div className="flex items-center justify-between px-4 py-3 border-b border-jt-border">
                  <h3 className="font-semibold text-jt-text">More</h3>
                  <button
                    onClick={() => setIsMoreOpen(false)}
                    className="p-2 rounded-lg hover:bg-jt-surface transition-colors"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Secondary Items */}
                <nav className="px-2 py-2 space-y-1" aria-label="Secondary navigation">
                  {moreItems
                    .filter((item) => item.mobilePriority === 'secondary')
                    .map((item) => {
                      const isActive = currentSection?.id === item.id;
                      const Icon = ICON_MAP[item.icon.name];
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            router.push(item.href);
                            setIsMoreOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-3',
                            'rounded-xl transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal',
                            isActive
                              ? 'bg-jt-teal/5 text-jt-teal'
                              : 'text-jt-text hover:bg-jt-surface',
                          )}
                        >
                          <Icon
                            size={22}
                            strokeWidth={2.2}
                            className="flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-medium truncate">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-jt-teal/10 text-jt-teal">
                              {item.badge}
                            </span>
                          )}
                          {item.keyboardShortcut && (
                            <kbd className="ml-auto px-2 py-0.5 text-[10px] font-mono text-jt-muted bg-jt-surface rounded">
                              {item.keyboardShortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                </nav>

                <div className="border-t border-jt-border my-2" />

                {/* More Items (Administration) */}
                <nav className="px-2 py-2 space-y-1" aria-label="Administration">
                  {moreItems
                    .filter((item) => item.mobilePriority === 'more')
                    .map((item) => {
                      const isActive = currentSection?.id === item.id;
                      const Icon = ICON_MAP[item.icon.name];
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            router.push(item.href);
                            setIsMoreOpen(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-3',
                            'rounded-xl transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal',
                            isActive
                              ? 'bg-jt-teal/5 text-jt-teal'
                              : 'text-jt-text hover:bg-jt-surface',
                          )}
                        >
                          <Icon
                            size={22}
                            strokeWidth={2.2}
                            className="flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-medium truncate">{item.label}</span>
                          {item.keyboardShortcut && (
                            <kbd className="ml-auto px-2 py-0.5 text-[10px] font-mono text-jt-muted bg-jt-surface rounded">
                              {item.keyboardShortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                </nav>

                {/* Search Shortcut */}
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    setSearchOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-jt-teal font-medium hover:bg-jt-teal/5 rounded-xl mx-2 mt-2 transition-colors"
                >
                  <Search size={20} strokeWidth={2.2} />
                  <span>Search…</span>
                  <kbd className="ml-auto px-2 py-0.5 text-[10px] font-mono text-jt-muted bg-jt-surface rounded">
                    ⌘K
                  </kbd>
                </button>

                <div className="px-4 py-3 text-center text-jt-muted text-xs border-t border-jt-border">
                  <kbd className="px-1.5 py-0.5 bg-jt-surface rounded">⌘K</kbd> to search
                </div>
              </div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <div
            className="fixed inset-0 z-50 bg-white"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-jt-border sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-jt-muted"
                    size={20}
                  />
                  <input
                    type="search"
                    placeholder="Search invoices, customers, payments…"
                    className="w-full pl-10 pr-12 py-3 bg-jt-surface border border-jt-border rounded-xl text-base text-jt-text placeholder-jt-muted focus:outline-none focus:ring-2 focus:ring-jt-teal"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSearchOpen(false);
                    }}
                  />
                  <button
                    onClick={() => setSearchOpen(false)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-jt-muted hover:text-jt-text"
                    aria-label="Close search"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Recent Searches */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-jt-muted mb-3 px-2">
                      Recent searches
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'INV-2024-001',
                        'Acme Corp',
                        'Payment ref: TXN-4521',
                        'Overdue invoices',
                      ].map((term) => (
                        <button
                          key={term}
                          onClick={() => {
                            setSearchOpen(false); /* TODO: navigate */
                          }}
                          className="px-3 py-1.5 text-sm text-jt-text bg-jt-surface border border-jt-border rounded-lg hover:bg-jt-teal/5 hover:border-jt-teal transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Filters */}
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-jt-muted mb-3 px-2">
                      Quick filters
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          label: 'Unpaid invoices',
                          icon: 'FileText',
                          href: '/invoices?status=issued',
                        },
                        {
                          label: 'Overdue',
                          icon: 'FileClock',
                          href: '/invoices?status=overdue',
                        },
                        {
                          label: 'This month',
                          icon: 'Activity',
                          href: '/reports?period=30',
                        },
                        {
                          label: 'Customers',
                          icon: 'Users',
                          href: '/customers',
                        },
                      ].map((item) => {
                        const Icon = ICON_MAP[item.icon];
                        return (
                          <a
                            key={item.label}
                            href={item.href}
                            className="flex items-center gap-3 p-3 bg-jt-surface border border-jt-border rounded-xl hover:bg-jt-teal/5 hover:border-jt-teal transition-colors"
                          >
                            <Icon size={20} className="text-jt-teal" />
                            <span className="font-medium">{item.label}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
