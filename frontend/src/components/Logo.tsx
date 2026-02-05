import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export default function Logo({ size = 40, className = '' }: LogoProps) {
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
          attributeType="XML"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="2s"
          repeatCount="indefinite"
        />
      </line>

      {/* Sweeper effect */}
      <path
        d="M50 50 L50 10 A40 40 0 0 1 90 50 Z"
        fill="url(#sweepGradient)"
        opacity="0.4"
      >
        <animateTransform
          attributeName="transform"
          attributeType="XML"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="2s"
          repeatCount="indefinite"
        />
      </path>

      {/* Detected systems (randomly placed dots) */}
      <circle cx="25" cy="40" r="2.5" fill="white" filter="url(#glow)">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.5s" />
      </circle>
      <circle cx="70" cy="30" r="2" fill="white" filter="url(#glow)">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="1.2s" />
      </circle>
      <circle cx="60" cy="75" r="3" fill="white" filter="url(#glow)">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="1.8s" />
      </circle>
      <circle cx="35" cy="70" r="2" fill="white" filter="url(#glow)">
        <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.8s" />
      </circle>

      {/* Data pulses */}
      <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="0.5" opacity="0.5">
        <animate attributeName="r" from="0" to="50" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
