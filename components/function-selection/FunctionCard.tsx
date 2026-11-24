'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { forwardRef, type KeyboardEvent, type Ref } from 'react';
import { cn } from '@/lib/utils';

export interface FunctionCardProps {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
  keyboardHint?: string;
  className?: string;
}

export const FunctionCard = forwardRef<HTMLButtonElement, FunctionCardProps>(
  (
    {
      id,
      label,
      description,
      icon,
      badge,
      selected,
      disabled,
      onSelect,
      keyboardHint,
      className,
      ...props
    },
    ref: Ref<HTMLButtonElement>,
  ) => {
    const handleClick = () => {
      if (!disabled) onSelect(id);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <motion.button
        ref={ref}
        type="button"
        role="menuitemradio"
        aria-checked={selected}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative flex flex-col items-start gap-3 p-5 rounded-xl border',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal focus-visible:ring-offset-2',
          selected
            ? 'border-jt-teal bg-jt-teal/5 shadow-[0_0_0_1px_var(--jt-teal)]'
            : 'border-jt-border hover:border-jt-teal/50 hover:bg-jt-surface',
          disabled && 'opacity-40 cursor-not-allowed',
          className,
        )}
        initial={false}
        animate={{
          boxShadow: selected
            ? '0 4px 16px -4px rgb(18 184 166 / 0.25), 0 0 0 1px var(--jt-teal)'
            : '0 1px 2px rgb(16 36 58 / 0.05)',
          scale: selected ? 1.005 : 1,
        }}
        transition={{
          duration: 0.18,
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={
          !disabled && !selected
            ? {
                y: -2,
                boxShadow: '0 8px 24px -8px rgb(16 36 58 / 0.12)',
                transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] },
              }
            : undefined
        }
        whileTap={!disabled ? { scale: 0.99 } : undefined}
        {...props}
      >
        {/* Icon with selection-state morph */}
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key="selected"
              initial={{ scale: 0.8, rotate: -12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.8, rotate: 12, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-jt-teal text-white"
            >
              {icon}
            </motion.div>
          ) : (
            <motion.div
              key="unselected"
              initial={{ scale: 0.8, rotate: 12, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0.8, rotate: -12, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-jt-secondary text-jt-text"
            >
              {icon}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-jt-text truncate">{label}</h3>
            {badge && (
              <motion.span
                key={badge}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex h-5 px-2 items-center rounded text-[10px] font-semibold uppercase tracking-wider bg-jt-teal/10 text-jt-teal"
              >
                {badge}
              </motion.span>
            )}
          </div>
          <p className="mt-1 text-sm text-jt-muted line-clamp-2">{description}</p>
        </div>

        {/* Keyboard hint — only visible on focus/hover */}
        {keyboardHint && (
          <motion.kbd
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="self-end opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150"
            style={{ fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}
          >
            {keyboardHint}
          </motion.kbd>
        )}

        {/* Selection indicator — Emil's "restrained delight" */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 4, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="absolute left-0 top-0 bottom-0 rounded-l-xl bg-jt-teal"
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
        </AnimatePresence>

        {/* Reduced motion fallback */}
        <style jsx>{`
          @media (prefers-reduced-motion: reduce) {
            * {
              animation-duration: 0.01ms !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>
      </motion.button>
    );
  },
);

FunctionCard.displayName = 'FunctionCard';
