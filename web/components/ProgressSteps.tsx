'use client';

import { Check, Loader2 } from 'lucide-react';

interface Step {
  label: string;
  status: 'pending' | 'active' | 'done';
}

interface ProgressStepsProps {
  steps: Step[];
}

export function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="flex items-center gap-1 mb-2">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center flex-1 min-w-0">
          {/* Step circle */}
          <div className={`
            flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all
            ${step.status === 'done' ? 'bg-emerald-500 text-black' : ''}
            ${step.status === 'active' ? 'bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400' : ''}
            ${step.status === 'pending' ? 'bg-white/5 text-white/30' : ''}
          `}>
            {step.status === 'done' ? <Check className="h-3.5 w-3.5" /> : 
             step.status === 'active' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 
             index + 1}
          </div>

          {/* Label */}
          <div className={`ml-1.5 text-[9px] font-medium tracking-wider truncate ${step.status === 'active' ? 'text-emerald-400' : 'text-white/40'}`}>
            {step.label}
          </div>

          {/* Connector line */}
          {index < steps.length - 1 && (
            <div className={`mx-1.5 h-px flex-1 ${step.status === 'done' ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
