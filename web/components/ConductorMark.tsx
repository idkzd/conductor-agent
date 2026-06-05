// Custom branded Conductor mark (orchestration metaphor: central conductor + 3 connected agents)
export function ConductorMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      <circle cx="16" cy="16" r="4" fill="currentColor" />
      <circle cx="8" cy="9" r="2.5" fill="currentColor" opacity="0.85" />
      <circle cx="24" cy="9" r="2.5" fill="currentColor" opacity="0.85" />
      <circle cx="16" cy="25" r="2.5" fill="currentColor" opacity="0.85" />
      <line x1="16" y1="16" x2="8" y2="9" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
      <line x1="16" y1="16" x2="24" y2="9" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
      <line x1="16" y1="16" x2="16" y2="25" stroke="currentColor" strokeWidth="1.25" opacity="0.6" />
    </svg>
  );
}
