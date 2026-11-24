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
  Search,
  X,
  LogOut,
  ChevronDown,
  Check,
  CircleHelp,
  ArrowRight,
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

interface DesktopSidebarProps {
  user: { name: string; email: string };
  data: any;
  section: string;
  setSection: (section: string) => void;
  setSidebarOpen: (open: boolean) => void;
  className?: string;
}

export function DesktopSidebar({
  user,
  data,
  section,
  setSection,
  setSidebarOpen,
  className,
}: DesktopSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [businessSwitcherOpen, setBusinessSwitcherOpen] = useState(false);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string; role: string }>>(
    [],
  );
  const sidebarRef = useRef<HTMLElement>(null);

  const currentSection = NAVIGATION_CONFIG.find(
    (n) => pathname === n.href || pathname.startsWith(n.href + '/'),
  );

  // Auto-expand on hover/focus
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const handleMouseEnter = () => {
      if (collapsed) setCollapsed(false);
    };
    const handleMouseLeave = () => {
      if (collapsed) setCollapsed(false);
    };

    sidebar.addEventListener('mouseenter', handleMouseEnter);
    sidebar.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      sidebar.removeEventListener('mouseenter', handleMouseEnter);
      sidebar.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [collapsed]);

  const shouldExpand = !collapsed;

  const groups = ['WORKSPACE', 'MANAGE', 'ADMINISTRATION'] as const;

  // Load businesses for switcher
  useEffect(() => {
    let mounted = true;
    async function loadBusinesses() {
      // This would call the actual API
      // For now, we'll use the data from props if available
    }
    loadBusinesses();
    return () => {
      /* cleanup */
    };
  }, []);

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        'fixed top-0 left-0 bottom-0 z-40',
        'bg-white border-r border-jt-border',
        'transition-all duration-200 ease-out',
        'overflow-y-auto',
        'shadow-xl',
        'flex flex-col',
        'z-40',
        className,
      )}
      role="navigation"
      aria-label="Main navigation"
      onMouseEnter={() => {
        /* handled by CSS hover */
      }}
    >
      <div className="h-full flex flex-col">
        {/* Brand & Workspace Switcher */}
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-4',
            'border-b border-jt-border',
            'transition-all duration-200',
          )}
        >
          <a
            href="/"
            className="flex items-center gap-2 flex-shrink-0"
            aria-label="JITHUB-TEQ home"
          >
            <span
              className="brand-mark w-8 h-8 flex items-center justify-center"
              style={{
                background: '#0B6E63',
                borderRadius: '9px',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontFamily: 'Georgia,serif',
                  fontSize: '20px',
                  fontWeight: 700,
                }}
              >
                J
              </span>
            </span>
            <span className="font-semibold text-jt-text truncate">JITHUB-TEQ</span>
          </a>
        </div>

        {/* Workspace Switcher */}
        <div className="px-4 py-3 border-b border-jt-border">
          <div className="flex items-center gap-3">
            <span className="workspace-emblem w-8 h-8 flex items-center justify-center rounded-lg bg-jt-teal text-white font-serif text-lg">
              J
            </span>
            <div className="flex-1 min-w-0">
              <strong className="text-jt-text truncate block">
                {data.business?.name || 'JITHUB-TEQ LTD'}
              </strong>
              <small className="text-jt-muted truncate block">
                {data.business?.city
                  ? `${data.business.city}, ${data.business.country}`
                  : 'Kampala, Uganda'}
              </small>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-jt-surface transition-colors text-jt-muted hover:text-jt-text"
              aria-label="Switch business"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-jt-border">
          <button
            className="w-full flex items-center gap-3 px-3 py-2.5 bg-jt-surface border border-jt-border rounded-xl text-jt-text hover:bg-jt-border transition-colors"
            aria-label="Search"
          >
            <Search size={18} className="text-jt-muted flex-shrink-0" />
            <span className="text-sm font-medium truncate">Searchâ€¦</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] font-mono text-jt-muted bg-jt-border rounded">
              âŒ˜K
            </kbd>
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main navigation">
          {['WORKSPACE', 'MANAGE', 'ADMINISTRATION'].map((group) => {
            const groupItems = NAVIGATION_CONFIG.filter((n) => n.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group}>
                <div className="px-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-jt-muted">
                    {group}
                  </span>
                </div>
                <div className="space-y-1" role="group" aria-label={group}>
                  {groupItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const badgeCount = data[item.id.toLowerCase().replace(/\s+/g, '') + 'Count'];
                    const Icon = ICON_MAP[item.icon.name];

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          /* navigation handled by parent */
                        }}
                        className={cn(
                          'w-full relative flex items-center gap-3 px-3 py-2.5',
                          'rounded-xl transition-colors duration-150',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal',
                          pathname === item.href || pathname.startsWith(item.href + '/')
                            ? 'bg-jt-teal/5 text-jt-teal'
                            : 'text-jt-text hover:bg-jt-surface',
                        )}
                        aria-current={
                          pathname === item.href || pathname.startsWith(item.href + '/')
                            ? 'page'
                            : undefined
                        }
                        aria-label={item.label}
                      >
                        <Icon
                          size={20}
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
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-jt-border space-y-2">
          <div className="flex items-center gap-3 p-3 bg-jt-surface rounded-xl">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-jt-teal/10">
              <CircleHelp size={16} className="text-jt-teal" />
            </div>
            <div className="flex-1 min-w-0">
              <strong className="text-jt-text text-sm block">Need a hand?</strong>
              <p className="text-jt-muted text-xs mt-0.5">We're here to help you get started.</p>
            </div>
            <button className="text-jt-teal text-sm font-medium hover:text-jt-teal-dark transition-colors">
              Visit help centre <ArrowRight size={12} />
            </button>
          </div>

          <div className="flex items-center gap-3 px-3 py-2 border-t border-jt-border pt-3">
            <span className="w-8 h-8 flex items-center justify-center rounded-full bg-jt-teal/10 text-jt-teal text-sm font-semibold">
              {user.name
                ?.split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'JT'}
            </span>
            <div className="flex-1 min-w-0">
              <strong className="text-jt-text text-sm truncate block">
                {user.name || 'Account owner'}
              </strong>
              <small className="text-jt-muted truncate block">{user.email}</small>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-jt-border transition-colors text-jt-muted hover:text-jt-text"
              aria-label="User menu"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
