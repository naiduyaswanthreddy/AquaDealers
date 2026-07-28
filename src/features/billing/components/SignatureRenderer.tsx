import React from 'react';
import { SignatureStroke } from '@/types/database';

interface SignatureRendererProps {
  strokes: SignatureStroke[] | null | undefined;
  className?: string;
  captureWidth?: number;
  captureHeight?: number;
}

export const SignatureRenderer: React.FC<SignatureRendererProps> = ({ strokes, className, captureWidth, captureHeight }) => {
  if (!strokes?.length) return null;

  // Use actual capture dimensions for the viewBox so the aspect ratio matches
  // what was drawn. Falls back to 1000×360 for old records without accurate dims.
  const vw = captureWidth ?? 1000;
  const vh = captureHeight ?? 360;

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="Customer signature"
    >
      <rect width={vw} height={vh} fill="#ffffff" />
      {strokes.map((stroke, index) => {
        if (!stroke.length) return null;
        const points = stroke
          .map((point) => `${point.x * vw},${point.y * vh}`)
          .join(' ');

        return (
          <polyline
            key={index}
            points={points}
            fill="none"
            stroke="#0f172a"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
};

export default SignatureRenderer;
