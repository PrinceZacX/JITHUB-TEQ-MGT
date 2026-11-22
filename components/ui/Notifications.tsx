'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
  action?: { label: string; onClick: () => void }
  dismissible?: boolean
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
  success: (title: string, message?: string, options?: Partial<Toast>) => string
  error: (title: string, message?: string, options?: Partial<Toast>) => string
  warning: (title: string, message?: string, options?: Partial<Toast>) => string
  info: (title: string, message?: string, options?: Partial<Toast>) => string
  loading: (title: string, message?: string, options?: Partial<Toast>) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9)
    const newToast = { ...toast, id, duration: toast.duration ?? 5000 }
    setToasts(prev => [...prev, newToast])

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, newToast.duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const clearToasts = useCallback(() => {
    setToasts([])
  }, [])

  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'success', title, message, ...options })
  }, [addToast])

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'error', title, message, duration: 8000, ...options })
  }, [addToast])

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'warning', title, message, duration: 7000, ...options })
  }, [addToast])

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'info', title, message, ...options })
  }, [addToast])

  const loading = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'loading', title, message, duration: 0, dismissible: false, ...options })
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts, success, error, warning, info, loading }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <AnimatePresence>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </div>
    </AnimatePresence>
  )
}

function Toast({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false)

  const handleRemove = () => {
    if (toast.dismissible !== false) {
      setIsExiting(true)
      setTimeout(() => onRemove(toast.id), 200)
    }
  }

  const ICONS = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
    loading: Loader2,
  }

  const COLORS = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    loading: 'bg-jt-surface border-jt-border text-jt-text',
  }

  const ICON_COLORS = {
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500',
    info: 'text-blue-500',
    loading: 'text-jt-teal',
  }

  const Icon = ICONS[toast.type]

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, y: 20 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: 100, y: 20 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex items-start gap-3 p-4 w-80 max-w-[calc(100vw-2rem)]',
        'rounded-xl border shadow-lg',
        'bg-white shadow-xl',
        COLORS[toast.type],
        isExiting && 'opacity-0'
      )}
      onMouseEnter={() => { /* pause auto-dismiss */ }}
      onMouseLeave={() => { /* resume auto-dismiss */ }}
    >
      <Icon className={cn('flex-shrink-0 mt-0.5', ICON_COLORS[toast.type])} size={20} />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{toast.title}</p>
        {toast.message && (
          <p className="text-sm opacity-80 mt-0.5">{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action?.onClick(); handleRemove() }}
            className="mt-2 text-sm font-medium underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {toast.dismissible !== false && (
        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} className="opacity-50 hover:opacity-100" />
        </button>
      )}
    </motion.div>
  )
}

// Hook for using toasts
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Convenience functions
export function useToastHelpers() {
  const { addToast } = useToast()

  const success = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'success', title, message, ...options })
  }, [addToast])

  const error = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'error', title, message, duration: 8000, ...options })
  }, [addToast])

  const warning = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'warning', title, message, duration: 7000, ...options })
  }, [addToast])

  const info = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'info', title, message, ...options })
  }, [addToast])

  const loading = useCallback((title: string, message?: string, options?: Partial<Toast>) => {
    return addToast({ type: 'loading', title, message, duration: 0, dismissible: false, ...options })
  }, [addToast])

  return { success, error, warning, info, loading }
}