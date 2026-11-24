'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { SEARCH_CONFIG } from './NavigationConfig';
import {
  Search,
  X,
  FileText,
  CreditCard,
  ReceiptText,
  Users,
  Building2,
  ClipboardList,
  Package,
  WalletCards,
  Activity,
  ShieldCheck,
  FileClock,
  Settings2,
  Filter,
  Clock,
  ChevronRight,
  Loader2,
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
  metadata?: Record<string, string>;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onResultSelect?: (result: SearchResult) => void;
  recentSearches?: string[];
  userPermissions?: string[];
}

export function SearchOverlay({
  isOpen,
  onClose,
  onResultSelect,
  recentSearches = [],
  userPermissions = [],
}: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeFilter, setActiveFilter] = useState<'all' | string>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const searchableSections = SEARCH_CONFIG.searchableSections;

  // Filter sections by permissions
  const allowedSections = searchableSections.filter((section) => {
    const config = SEARCH_CONFIG.filters[section];
    if (!config) return true;
    const navItem = SEARCH_CONFIG.searchableSections.find((s) => s === section);
    return true; // Simplified - would check actual permissions
  });

  // Debounced search
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // In a real implementation, this would call an API
        // For now, simulate with mock data
        await new Promise((resolve) => setTimeout(resolve, 200));
        const mockResults = generateMockResults(searchQuery);
        setResults(mockResults);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, SEARCH_CONFIG.debounceMs),
    [],
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            onResultSelect?.(results[selectedIndex]);
            onClose();
          }
          break;
        case 'Tab':
          if (e.shiftKey) {
            e.preventDefault();
            setSelectedIndex((prev) => Math.max(prev - 1, -1));
          } else {
            e.preventDefault();
            setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          }
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  // Focus trap
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const focusableElements = overlayRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const SECTION_ICONS: Record<string, typeof FileText> = {
    Invoices: FileText,
    Payments: CreditCard,
    Receipts: ReceiptText,
    Customers: Users,
    Suppliers: Building2,
    'Purchase Orders': ClipboardList,
    'Goods Receipts': Package,
    'Stock Movements': WalletCards,
    'Products & services': Package,
    Expenses: WalletCards,
    Reports: Activity,
    'User management': ShieldCheck,
    'Audit logs': FileClock,
    Settings: Settings2,
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-jt-border sticky top-0 bg-white z-10">
          <div className="relative max-w-3xl mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-jt-muted" size={20} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoices, customers, payments, receipts…"
              className="w-full pl-10 pr-12 py-3 bg-jt-surface border border-jt-border rounded-xl text-base text-jt-text placeholder-jt-muted focus:outline-none focus:ring-2 focus:ring-jt-teal"
              autoFocus
              aria-label="Search"
              aria-autocomplete="list"
              aria-controls="search-results"
            />
            {isLoading && (
              <Loader2
                className="absolute right-10 top-1/2 -translate-y-1/2 text-jt-teal animate-spin"
                size={20}
              />
            )}
            <button
              onClick={onClose}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-jt-muted hover:text-jt-text"
              aria-label="Close search"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-jt-border sticky top-16 bg-white/80 backdrop-blur z-10">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
                activeFilter === 'all'
                  ? 'bg-jt-teal text-white'
                  : 'bg-jt-surface text-jt-text hover:bg-jt-border',
              )}
            >
              All
            </button>
            {allowedSections.map((section) => (
              <button
                key={section}
                onClick={() => setActiveFilter(section)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-full transition-colors whitespace-nowrap',
                  activeFilter === section
                    ? 'bg-jt-teal text-white'
                    : 'bg-jt-surface text-jt-text hover:bg-jt-border',
                )}
              >
                {section}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div
          id="search-results"
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-4"
          role="listbox"
          aria-label="Search results"
        >
          {query.trim().length === 0 ? (
            <div className="space-y-6">
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-jt-muted">
                      Recent searches
                    </h3>
                    <button
                      className="text-sm text-jt-teal hover:text-jt-teal-dark"
                      onClick={() => {
                        /* clear recent */
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.slice(0, 8).map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          setSelectedIndex(-1);
                        }}
                        className="px-3 py-1.5 text-sm text-jt-text bg-jt-surface border border-jt-border rounded-lg hover:bg-jt-teal/5 hover:border-jt-teal transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Filters */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-jt-muted mb-3">
                  Quick filters
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    {
                      label: 'Unpaid invoices',
                      icon: FileText,
                      filter: 'Invoices',
                      query: 'status:issued',
                    },
                    {
                      label: 'Overdue',
                      icon: FileClock,
                      filter: 'Invoices',
                      query: 'status:overdue',
                    },
                    {
                      label: 'This month',
                      icon: Activity,
                      filter: 'Reports',
                      query: 'period:30',
                    },
                    {
                      label: 'Customers',
                      icon: Users,
                      filter: 'Customers',
                      query: '',
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setQuery(item.query);
                        setActiveFilter(item.filter);
                        setSelectedIndex(-1);
                      }}
                      className="flex items-center gap-3 p-3 bg-jt-surface border border-jt-border rounded-xl hover:bg-jt-teal/5 hover:border-jt-teal transition-colors text-left"
                    >
                      <item.icon size={20} className="text-jt-teal" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Sections */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-jt-muted mb-3">
                  Jump to
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {allowedSections.map((section) => {
                    const Icon = SECTION_ICONS[section];
                    return (
                      <button
                        key={section}
                        onClick={() => {
                          setActiveFilter(section);
                          setQuery('');
                          setSelectedIndex(-1);
                        }}
                        className="flex items-center gap-3 p-3 bg-jt-surface border border-jt-border rounded-xl hover:bg-jt-teal/5 hover:border-jt-teal transition-colors"
                      >
                        <Icon size={20} className="text-jt-teal" />
                        <span className="font-medium truncate">{section}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-jt-teal animate-spin" size={24} />
              <span className="ml-3 text-jt-muted">Searching…</span>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <X className="text-jt-muted" size={48} />
              <h3 className="mt-4 text-jt-text">No results found</h3>
              <p className="mt-1 text-jt-muted">Try adjusting your search terms or filters</p>
            </div>
          ) : (
            <div className="space-y-2" role="listbox" aria-label="Search results">
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => {
                    onResultSelect?.(result);
                    onClose();
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal',
                    selectedIndex === index
                      ? 'bg-jt-teal/5 ring-2 ring-jt-teal'
                      : 'hover:bg-jt-surface',
                  )}
                  role="option"
                  aria-selected={selectedIndex === index}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-jt-teal/10 text-jt-teal flex-shrink-0">
                    {(() => {
                      const Icon = SECTION_ICONS[result.type];
                      return Icon ? <Icon size={20} /> : null;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-jt-text truncate">{result.title}</span>
                      {result.badge && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-jt-teal/10 text-jt-teal">
                          {result.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-jt-muted truncate">{result.subtitle}</p>
                    {result.metadata && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(result.metadata).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-0.5 text-[10px] text-jt-muted bg-jt-border rounded"
                          >
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-jt-muted flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <div className="px-4 py-3 border-t border-jt-border bg-white/80 backdrop-blur sticky bottom-0">
          <div className="flex items-center justify-center gap-4 text-xs text-jt-muted">
            <kbd className="px-1.5 py-0.5 bg-jt-surface rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-jt-surface rounded">↓</kbd>
            <span>Navigate</span>
            <kbd className="px-1.5 py-0.5 bg-jt-surface rounded">↵</kbd>
            <span>Select</span>
            <kbd className="px-1.5 py-0.5 bg-jt-surface rounded">Esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

function generateMockResults(query: string): any[] {
  // This would be replaced with actual API calls
  const mockData = [
    {
      id: 'inv-1',
      type: 'Invoices',
      title: 'INV-2024-001',
      subtitle: 'Acme Corp · UGX 5,000,000 · Issued',
      href: '/invoices/inv-1',
      badge: 'issued',
    },
    {
      id: 'cust-1',
      type: 'Customers',
      title: 'Acme Corporation',
      subtitle: 'acme@example.com · Kampala',
      href: '/customers/cust-1',
    },
    {
      id: 'pay-1',
      type: 'Payments',
      title: 'Payment for INV-2024-001',
      subtitle: 'UGX 5,000,000 · Mobile Money',
      href: '/payments/pay-1',
      badge: 'completed',
    },
    {
      id: 'rec-1',
      type: 'Receipts',
      title: 'RCP-2024-001',
      subtitle: 'Acme Corp · UGX 5,000,000',
      href: '/receipts/rec-1',
    },
  ];

  return mockData
    .filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle.toLowerCase().includes(query.toLowerCase()),
    )
    .map((item) => ({
      ...item,
      metadata: { section: item.type },
    }));
}

const SECTION_ICONS: Record<string, typeof FileText> = {
  Invoices: FileText,
  Payments: CreditCard,
  Receipts: ReceiptText,
  Customers: Users,
  Suppliers: Building2,
  'Purchase Orders': ClipboardList,
  'Goods Receipts': Package,
  'Stock Movements': WalletCards,
  'Products & services': Package,
  Expenses: WalletCards,
  Reports: Activity,
  'User management': ShieldCheck,
  'Audit logs': FileClock,
  Settings: Settings2,
};
