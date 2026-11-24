'use client';

import { cn } from '@/lib/utils';
import { EMPTY_STATES } from '@/components/navigation/NavigationConfig';
import {
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
  Plus,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  Inbox,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SmartEmptyStateProps {
  section: string;
  className?: string;
  customTitle?: string;
  customDescription?: string;
  customPrimaryAction?: { label: string; href: string; onClick?: () => void };
  customSecondaryAction?: { label: string; href: string; onClick?: () => void };
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  filters?: string[];
  onFilterChange?: (filters: string[]) => void;
  count?: number;
  variant?: 'default' | 'inline' | 'card';
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
  Notifications: FileText,
};

export function SmartEmptyState({
  section,
  className,
  customTitle,
  customDescription,
  customPrimaryAction,
  customSecondaryAction,
  showSearch = false,
  onSearch,
  filters,
  onFilterChange,
  count = 0,
  variant = 'default',
}: SmartEmptyStateProps) {
  const emptyState = EMPTY_STATES[section] || EMPTY_STATES.default;

  const title = customTitle || EMPTY_STATES[section]?.title || 'No results';
  const description = customDescription || EMPTY_STATES[section]?.description || 'No data found';
  const primaryAction = customPrimaryAction || EMPTY_STATES[section]?.primaryAction;
  const secondaryAction = customSecondaryAction || EMPTY_STATES[section]?.secondaryAction;

  const hasFilters = filters && filters.length > 0;

  if (variant === 'inline') {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center rounded-2xl bg-jt-surface border border-jt-border">
          <FileText size={32} className="text-jt-muted" />
        </div>
        <div className="text-center">
          <p className="font-medium text-jt-text">{title}</p>
          <p className="text-sm text-jt-muted mt-1">{description}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-12 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 flex items-center justify-center"
        >
          <div className="flex items-center justify-center rounded-2xl bg-jt-surface border border-jt-border">
            <FileText size={64} className="text-jt-muted" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mb-4"
        >
          <h3 className="text-lg font-semibold text-jt-text mb-2">No results</h3>
          <p className="text-jt-muted leading-relaxed">No data found</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="mb-4 p-3 bg-jt-teal/5 border border-jt-teal/20 rounded-xl"
        >
          <div className="flex items-center gap-2 text-jt-teal text-sm">
            <span className="font-medium">Active filters applied</span>
          </div>
          <button className="mt-2 text-sm text-jt-teal hover:text-jt-teal-dark font-medium">
            Clear all filters
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="mb-6"
        >
          <div className="relative">
            <input
              type="search"
              placeholder="Search…"
              className="w-full pl-10 pr-4 py-3 bg-jt-surface border border-jt-border rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-jt-teal"
            />
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <button className="flex items-center gap-2 px-6 py-3 text-white bg-jt-teal rounded-xl hover:bg-jt-teal-dark transition-colors">
            <span className="font-semibold">Primary</span>
          </button>
          <button className="px-6 py-3 text-jt-text bg-white border border-jt-border rounded-xl hover:bg-jt-surface hover:border-jt-teal transition-colors">
            <span className="font-semibold">Secondary</span>
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.2 }}
          className="mt-4 text-sm text-jt-muted"
        >
          Showing 0 results
        </motion.p>
      </motion.div>
    </div>
  );
}
