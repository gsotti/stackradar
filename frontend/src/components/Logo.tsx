import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
  showWordmark?: boolean;
}

export default function Logo({ size = 40, className = '', animated = false, showWordmark = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={animated ? 'animate-sweep' : ''} style={{ color: 'currentColor' }}>
        <path d="M12 2L20.8 7V17L12 22L3.2 17V7Z" stroke="currentColor" strokeWidth="0.75" fill="none" opacity="0.6" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="0.75" fill="none" opacity="0.4" />
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="0.75" fill="none" opacity="0.25" />
        <circle cx="12" cy="12" r="2" fill="currentColor" className={animated ? 'animate-pulse-subtle' : ''} />
        <path d="M17 7L19 5" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.4" />
      </svg>
      {showWordmark && (
        <div className="flex flex-col gap-0 leading-tight">
          <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">Stack</span>
          <span className="text-xs font-normal tracking-tight text-neutral-600 dark:text-neutral-300">Radar</span>
        </div>
      )}
    </div>
  );
}
