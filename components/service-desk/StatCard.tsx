'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: number | string;
  icon: React.ComponentType<any>;
  color?: string;
  href?: string;
  className?: string;
  trend?: { label: string; value: number; positive: boolean };
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'bg-blue-100 text-blue-600 border border-blue-200',
  href,
  className,
  trend,
}: StatCardProps) {
  const card = (
    <motion.div
      className={cn(
        'group relative overflow-hidden border border-jt-border bg-jt-surface rounded-[var(--jt-radius-lg)] p-6',
        className,
      )}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium text-jt-muted uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-jt-text leading-tight">{value}</p>
          {trend && (
            <p className="mt-1.5 text-xs font-medium leading-none">
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  trend.positive ? 'text-green-600' : 'text-rose-600',
                )}
              >
                <span className={`w-1 h-1 rounded-full ${trend.positive ? 'bg-green-500' : 'bg-rose-500'}`} />
                {trend.label}
              </span>
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-center w-12 h-12 rounded-xl bg-white/50 border border-white/60">
          <Icon size={18} className="text-jt-muted" />
        </div>
      </div>
      {/* Decorative accent line on right edge */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 w-1/3 bg-gradient-to-r from-transparent via-jt-teal to-transparent" />
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}
