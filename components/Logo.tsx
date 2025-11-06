import React from 'react';

interface LogoProps {
  /** Size variant for different use cases */
  size?: 'small' | 'medium' | 'large';
  /** Optional className for additional styling */
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  // Size-based heights (maintaining aspect ratio ~2.33:1 from SVG viewBox 1400x600)
  const heights = {
    small: 63,   // Header size - 50% larger (~147px wide)
    medium: 68,  // Default size (~158px wide)
    large: 180   // Landing page size - 50% larger (~420px wide)
  };

  const height = heights[size];

  return (
    <a 
      href="https://linearis.io/contact/" 
      target="_blank" 
      rel="noopener noreferrer"
      className={`inline-flex items-center hover:opacity-80 transition-opacity no-underline text-inherit ${className}`}
      title="Visit Linearis Contact Page"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <img 
        src="/linearis-logo.svg" 
        alt="LINEARIS Logo"
        style={{ height: `${height}px`, width: 'auto' }}
        className="object-contain"
      />
    </a>
  );
};

export default Logo;
