'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { WORKFLOW_STEPS } from '@/components/navigation/NavigationConfig'
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  X,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Step {
  label: string
  description: string
  optional?: boolean
  isValid?: boolean
  isComplete?: boolean
}

interface ProgressiveDisclosureProps {
  workflow: keyof typeof WORKFLOW_STEPS | Step[]
  currentStep: number
  onStepChange: (step: number) => void
  onNext: () => Promise<void> | void
  onBack: () => void
  onSubmit: () => Promise<void> | void
  isSubmitting?: boolean
  canGoBack?: boolean
  canGoNext?: boolean
  className?: string
  children: (step: Step, index: number, isActive: boolean) => React.ReactNode
}

export function ProgressiveDisclosure({
  workflow,
  currentStep,
  onStepChange,
  onNext,
  onBack,
  onSubmit,
  isSubmitting = false,
  canGoBack = true,
  canGoNext = true,
  className,
  children,
}: ProgressiveDisclosureProps) {
  const steps = Array.isArray(workflow) ? workflow : WORKFLOW_STEPS[workflow] || []
  const totalSteps = steps.length
  const isLastStep = currentStep === totalSteps - 1
  const isFirstStep = currentStep === 0

  const handleNext = async () => {
    if (!canGoNext || isSubmitting) return
    await onNext()
  }

  const handleBack = () => {
    if (!canGoBack || isFirstStep) return
    onBack()
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    await onSubmit()
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Step Indicator */}
      <div className="mb-6" role="navigation" aria-label="Workflow progress">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col items-center flex-1 relative"
            >
              {/* Connector line */}
              {index < totalSteps - 1 && (
                <div className="absolute top-5 left-1/2 right-0 h-1 w-full z-0">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: index < currentStep ? '100%' : '0%' }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full bg-jt-teal rounded"
                  />
                </div>
              )}

              {/* Step Circle */}
              <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200">
                {index < currentStep ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-5 h-5 text-white"
                  >
                    <CheckCircle2 size={20} className="text-jt-teal" />
                  </motion.div>
                ) : index === currentStep ? (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-10 h-10 bg-jt-teal text-white flex items-center justify-center"
                  >
                    <span className="font-semibold text-sm">{index + 1}</span>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-10 h-10 border-2 border-jt-border bg-white text-jt-muted flex items-center justify-center"
                  >
                    <span className="font-semibold text-sm">{index + 1}</span>
                  </motion.div>
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center w-32">
                <p className={cn(
                  'text-xs font-medium truncate',
                  index <= currentStep ? 'text-jt-text' : 'text-jt-muted'
                )}>
                  {step.label}
                </p>
                {step.optional && (
                  <span className="text-[10px] text-jt-muted">(optional)</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[300px]"
        >
          <div className="bg-white border border-jt-border rounded-xl p-6">
            {children(steps[currentStep], currentStep, true)}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between pt-4 border-t border-jt-border">
        <div className="flex items-center gap-3">
          {canGoBack && !isFirstStep && (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2.5 text-jt-text bg-white border border-jt-border rounded-xl hover:bg-jt-surface hover:border-jt-teal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal"
            >
              <ArrowLeft size={18} />
              <span className="font-medium">Back</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {isLastStep ? (
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-2 px-6 py-2.5 text-white bg-jt-teal rounded-xl hover:bg-jt-teal-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-semibold">Processingâ€¦</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">Submit</span>
                  <ArrowRight size={18} />
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext || isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex items-center gap-2 px-6 py-2.5 text-white bg-jt-teal rounded-xl hover:bg-jt-teal-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jt-teal focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="font-semibold">Next</span>
              <ArrowRight size={18} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}

