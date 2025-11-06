import React from 'react';

interface LogoProps {
  /** Size variant for different use cases */
  size?: 'small' | 'medium' | 'large';
  /** Optional className for additional styling */
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  // Size-based dimensions for the icon
  const iconSizes = {
    small: { width: 24, height: 24 },
    medium: { width: 32, height: 32 },
    large: { width: 48, height: 48 }
  };

  // Text sizes
  const textSizes = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-3xl'
  };

  const iconSize = iconSizes[size];
  const textSize = textSizes[size];

  return (
    <a 
      href="https://linearis.io/contact/" 
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center gap-2 hover:opacity-80 transition-opacity no-underline text-inherit ${className}`}
      title="Visit Linearis Contact Page"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      {/* LINEARIS Icon - L shape with square */}
      <svg
        width={iconSize.width}
        height={iconSize.height}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Outer square outline */}
        <rect
          x="2"
          y="2"
          width="28"
          height="28"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        {/* Inner square in top-left */}
        <rect
          x="4"
          y="4"
          width="8"
          height="8"
          fill="currentColor"
        />
        {/* L shape - horizontal line from inner square to right edge */}
        <rect
          x="4"
          y="12"
          width="24"
          height="2"
          fill="currentColor"
        />
        {/* L shape - vertical line extending down */}
        <rect
          x="4"
          y="14"
          width="2"
          height="16"
          fill="currentColor"
        />
      </svg>
      
      {/* LINEARIS Text */}
      <span className={`font-bold text-white uppercase tracking-tight ${textSize}`}>
        LINEARIS
      </span>
    </a>
  );
};

export default Logo;
