import React from 'react';

interface AquaLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

/**
 * AquaLoader — A premium, professional loading screen for AquaDealer.
 * Features an orbital arc spinner around the logo, shimmer bar, and clean typography.
 */
export const AquaLoader: React.FC<AquaLoaderProps> = ({
  message = 'Loading...',
  fullScreen = true,
}) => {
  const content = (
    <div className="aqua-loader">
      {/* Soft ambient glow behind logo */}
      <div className="aqua-loader__glow" aria-hidden="true" />

      {/* Logo with orbital spinner */}
      <div className="aqua-loader__orbit-wrap">
        {/* Spinning arc */}
        <svg className="aqua-loader__orbit" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="54" stroke="rgba(0,82,204,0.08)" strokeWidth="3" />
          <path
            d="M60 6 A54 54 0 0 1 114 60"
            stroke="url(#aqua-grad)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="aqua-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0052cc" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#3385ff" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>

        {/* Logo */}
        <img
          src="/logo.png"
          alt="AquaDealer"
          className="aqua-loader__logo"
        />
      </div>

      {/* Brand name + message */}
      <div className="aqua-loader__text">
        <span className="aqua-loader__brand">AquaDealer</span>
        {message && <span className="aqua-loader__message">{message}</span>}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="aqua-loader__overlay" role="status" aria-live="polite">
        {content}
      </div>
    );
  }

  return (
    <div className="aqua-loader__inline" role="status" aria-live="polite">
      {content}
    </div>
  );
};

export default AquaLoader;
