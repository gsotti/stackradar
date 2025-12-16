import React from 'react';

export default function Logo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="radarGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="radarGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="sweepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="50%" stopColor="#10b981" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Outer gradient circle */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="url(#radarGradient1)"
        opacity="0.15"
      />

      {/* Main background circle */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="url(#radarGradient1)"
      />

      {/* Radar rings */}
      <circle
        cx="50"
        cy="50"
        r="32"
        stroke="white"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      <circle
        cx="50"
        cy="50"
        r="24"
        stroke="white"
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />
      <circle
        cx="50"
        cy="50"
        r="16"
        stroke="white"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      <circle
        cx="50"
        cy="50"
        r="8"
        stroke="white"
        strokeWidth="1"
        fill="none"
        opacity="0.6"
      />

      {/* Center dot */}
      <circle
        cx="50"
        cy="50"
        r="3"
        fill="white"
        filter="url(#glow)"
      />

      {/* Radar sweep line (from center to edge) */}
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="15"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.8"
        filter="url(#glow)"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="3s"
          repeatCount="indefinite"
        />
      </line>

      {/* Radar sweep gradient arc */}
      <path
        d="M 50 50 L 50 15 A 35 35 0 0 1 70 25 Z"
        fill="url(#sweepGradient)"
        opacity="0.4"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="3s"
          repeatCount="indefinite"
        />
      </path>

      {/* Detection blips */}
      <circle cx="65" cy="35" r="2.5" fill="#10b981" opacity="0.9">
        <animate
          attributeName="opacity"
          values="0.9;0.3;0.9"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="2.5;3.5;2.5"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>

      <circle cx="38" cy="28" r="2" fill="#3b82f6" opacity="0.8">
        <animate
          attributeName="opacity"
          values="0.8;0.3;0.8"
          dur="2.5s"
          repeatCount="indefinite"
        />
      </circle>

      <circle cx="60" cy="62" r="2.5" fill="#8b5cf6" opacity="0.85">
        <animate
          attributeName="opacity"
          values="0.85;0.3;0.85"
          dur="3s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="r"
          values="2.5;3.5;2.5"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Grid lines (crosshair) */}
      <line x1="50" y1="14" x2="50" y2="86" stroke="white" strokeWidth="0.5" opacity="0.2" />
      <line x1="14" y1="50" x2="86" y2="50" stroke="white" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}

export function LogoIcon({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>

      {/* Simplified radar for small sizes */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="url(#iconGradient)"
      />

      {/* Simple rings */}
      <circle cx="50" cy="50" r="35" stroke="white" strokeWidth="1.5" fill="none" opacity="0.3" />
      <circle cx="50" cy="50" r="25" stroke="white" strokeWidth="1.5" fill="none" opacity="0.4" />
      <circle cx="50" cy="50" r="15" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />

      {/* Center */}
      <circle cx="50" cy="50" r="4" fill="white" />

      {/* Sweep line */}
      <line x1="50" y1="50" x2="50" y2="20" stroke="#10b981" strokeWidth="3" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="3s"
          repeatCount="indefinite"
        />
      </line>

      {/* Blips */}
      <circle cx="68" cy="32" r="3" fill="white" opacity="0.9" />
      <circle cx="35" cy="40" r="2.5" fill="white" opacity="0.8" />
    </svg>
  );
}
