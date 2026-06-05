'use client';

import { motion } from 'framer-motion';

interface ExecutionLogProps {
  logs: string[];
  isRunning: boolean;
}

export function ExecutionLog({ logs, isRunning }: ExecutionLogProps) {
  if (logs.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-7"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="section-title">AUDIT STREAM — LIVE FROM CONDUCTOR</div>
        {isRunning && (
          <div className="text-[10px] text-emerald-400 flex items-center gap-1.5">
            <div className="w-1 h-1 bg-emerald-400 rounded-full animate-ping" /> THINKING
          </div>
        )}
      </div>
      <div className="execution-log p-4 max-h-[240px] overflow-auto">
        {logs.map((line, i) => (
          <div key={i} className="log-line">{line}</div>
        ))}
      </div>
    </motion.div>
  );
}
