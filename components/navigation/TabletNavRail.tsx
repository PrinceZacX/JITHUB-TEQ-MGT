'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAVIGATION_CONFIG } from './NavigationConfig';
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
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Grid,
  List,
  Search,
  X,
} from 'lucide-react';

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

interface TabletNavRailProps {
  className?: string;
  badgeCounts?: Record<string, number>;
  onSearchOpen?: () => void;
}

export function TabletNavRail({ className, badgeCounts = {}, onSearchOpen }: TabletNavRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const railRef = useRef<HTMLElement>(null);

  const shouldExpand = !collapsed || hovered;

  // Auto-expand on hover/focus
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleMouseEnter = () => {
      setHovered(true);
      if (collapsed) setCollapsed(false);
    };
    const handleMouseLeave = () => {
      setHovered(false);
      if (collapsed) setCollapsed(false);
    };

    rail.addEventListener('mouseenter', handleMouseEnter);
    rail.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      rail.removeEventListener('mouseenter', handleMouseEnter);
      rail.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [collapsed]);

  // Auto-expand when focused
  useEffect(() => {
    const handleFocusIn = () => setHovered(true);
    const handleFocusOut = () => setHovered(false);

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const groups = ['WORKSPACE', 'MANAGE', 'ADMINISTRATION'] as const;

  return (
    <aside
      ref={railRef}
      className={cn(
        'fixed top-0 left-0 bottom-0 z-40',
        'bg-jt-nav border-r border-white/10',
        'transition-all duration-200 ease-out',
        'overflow-y-auto',
        'flex flex-col',
        collapsed ? 'w-16' : 'w-64',
        className,
      )}
      role="navigation"
      aria-label={collapsed ? 'Navigation (collapsed)' : 'Main navigation'}
      onMouseEnter={() => {
        setHovered(true);
        if (collapsed) setCollapsed(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
        if (collapsed) setCollapsed(false);
      }}
    >
      <div className="h-full flex flex-col">
        {/* Brand */}
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-4',
            'border-b border-white/10',
            'transition-all duration-200',
            collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}
        >
          <a href="/" className="flex items-center gap-2" aria-label="JITHUB-TEQ home">
            <span
              className="brand-mark w-8 h-8"
              style={{
                background: 'rgb(255 255 255 / 12%)',
                border: '1px solid rgb(255 255 255 / 20%)',
              }}
            >
              <span
                style={{
                  color: 'var(--jt-teal-on-dark)',
                  fontFamily: 'Georgia,serif',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                J
              </span>
            </span>
            {!collapsed && <span className="font-semibold text-white truncate">JITHUB-TEQ</span>}
          </a>
        </div>

        {/* Search Trigger */}
        <div
          className={cn(
            'px-3 py-2',
            'transition-all duration-200',
            collapsed ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100',
          )}
        >
          <button
            onClick={onSearchOpen}
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-jt-nav-text hover:bg-white/10 transition-colors"
            aria-label="Search"
          >
            <Search size={18} className="text-jt-nav-muted flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium truncate">Search…</span>}
            {!collapsed && (
              <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono text-jt-nav-muted bg-white/5 rounded">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-6" aria-label="Main navigation">
          {['WORKSPACE', 'MANAGE', 'ADMINISTRATION'].map((group) => {
            const groupItems = NAVIGATION_CONFIG.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div
                key={group}
                className={cn(
                  'transition-all duration-200',
                  collapsed ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100',
                )}
              >
                {!collapsed && (
                  <div className="px-2 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-jt-nav-muted">
                      {group}
                    </span>
                  </div>
                )}
                <div className="space-y-1" role="group" aria-label={group}>
                  {groupItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const badgeCount = badgeCounts[item.id];
                    const Icon = ICON_MAP[item.icon.name];

                    return (
                      <button
                        key={item.id}
                        onClick={() => router.push(item.href)}
                        className={cn(
                          'relative flex items-center gap-3 px-3 py-2.5',
                          'rounded-xl transition-colors duration-150',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal',
                          isActive
                            ? 'bg-jt-nav-active text-white'
                            : 'text-jt-nav-text hover:bg-white/5',
                          collapsed ? 'justify-center px-2' : '',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={item.label}
                      >
                        <Icon
                          size={20}
                          strokeWidth={2.2}
                          className="flex-shrink-0"
                          aria-hidden="true"
                        />
                        {!collapsed && (
                          <>
                            <span className="font-medium truncate">{item.label}</span>
                            {badgeCounts[item.id] && badgeCounts[item.id]! > 0 && (
                              <span className="ml-auto">
                                <span className="inline-flex items-center justify-center min-w-[18px] h-5 px-1.5 text-[10px] font-semibold rounded-full bg-jt-teal text-white">
                                  {badgeCounts[item.id]! > 99 ? '99+' : badgeCounts[item.id]}
                                </span>
                              </span>
                            )}
                            {item.keyboardShortcut && (
                              <kbd className="ml-auto px-2 py-0.5 text-[10px] font-mono text-jt-nav-muted bg-white/5 rounded">
                                {item.keyboardShortcut}
                              </kbd>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Collapse/Expand Toggle */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2',
              'rounded-xl transition-colors',
              'bg-white/5 hover:bg-white/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal',
            )}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight size={18} className="text-jt-nav-text" />
            ) : (
              <>
                <ChevronLeft size={18} className="text-jt-nav-text flex-shrink-0" />
                <span className="text-sm font-medium text-jt-nav-text">Collapse</span>
              </>
            )}
          </button>
        </div>

        {/* Footer Actions */}
        <div
          className={cn(
            'px-2 pb-3 space-y-2',
            collapsed ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100',
          )}
        >
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-jt-nav-text hover:bg-white/10 transition-colors"
            onClick={() => {
              /* TODO: notifications */
            }}
          >
            <Bell size={20} className="text-jt-nav-muted" />
            {!collapsed && <span className="font-medium truncate">Notifications</span>}
          </button>
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-jt-nav-text hover:bg-white/10 transition-colors"
            onClick={() => {
              /* TODO: help */
            }}
          >
            <MoreHorizontal size={20} className="text-jt-nav-muted" />
            {!collapsed && <span className="font-medium truncate">Help & Support</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

import { AnimatePresence } from 'framer-motion';
