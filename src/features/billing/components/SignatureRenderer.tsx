import React from 'react';
import { SignatureStroke } from '@/types/database';

interface SignatureRendererProps {
  strokes: SignatureStroke[] | null | undefined;
  className?: string;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 360;

export const SignatureRenderer: React.FC<SignatureRendererProps> = ({ strokes, className }) => {
  if (!strokes?.length) return null;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="Customer signature"
    >
      <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="#ffffff" />
      {strokes.map((stroke, index) => {
        if (!stroke.length) return null;
        const points = stroke
          .map((point) => `${point.x * VIEWBOX_WIDTH},${point.y * VIEWBOX_HEIGHT}`)
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
