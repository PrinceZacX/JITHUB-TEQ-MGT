'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FunctionCard } from './FunctionCard';

export interface FunctionItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  keyboardHint?: string;
}

export interface FunctionGridProps {
  items: FunctionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  disabledIds?: string[];
  className?: string;
}

export function FunctionGrid({
  items,
  selectedId,
  onSelect,
  disabledIds = [],
  className,
}: FunctionGridProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <motion.div
      className={cn('grid gap-4', className)}
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      role="group"
      aria-label="Function selection"
    >
      {items.map((item) => (
        <motion.div key={item.id} variants={itemVariants}>
          <FunctionCard
            id={item.id}
            label={item.label}
            description={item.description}
            icon={item.icon}
            badge={item.badge}
            keyboardHint={item.keyboardHint}
            selected={selectedId === item.id}
            disabled={disabledIds.includes(item.id)}
            onSelect={onSelect}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}