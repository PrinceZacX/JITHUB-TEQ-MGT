'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: number | string;
  icon: React.ComponentType<any>;
  color: string;
  href?: string;
  className?: string;
};

export function StatCard({ label, value, icon: Icon, color, href, className }: StatCardProps) {
  return (
    <Link
      href={href || '#'}
      className={cn(
        'block border border-jt-border rounded-[var(--jt-radius)] bg-jt-surface transition-all hover:shadow-lg hover:-translate-y-1 hover:border-jt-teal/30 group',
        className,
      )}
    >
      <div className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-jt-muted uppercase tracking-wider">{label}</p>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} text-white group-hover:scale-110 transition-transform`}
          >
            <Icon size={20} />
          </div>
        </div>
        <p className="mt-4 text-3xl font-bold text-jt-text">{value}</p>
      </div>
    </Link>
  );
}
