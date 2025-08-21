import React from 'react';

interface LogoProps {
  /** Size variant for different use cases */
  size?: 'small' | 'medium' | 'large';
  /** Optional className for additional styling */
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', className = '' }) => {
  const sizeClasses = {
    small: 'h-8', // Header size
    medium: 'h-12', // Default size
    large: 'h-16' // Landing page size
  };

  const logoSrc = '/logo.png'; // Place your logo file in the public folder

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={logoSrc}
        alt="Company Logo"
        className={`${sizeClasses[size]} w-auto object-contain`}
        onError={(e) => {
          // Fallback to text if logo doesn't load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) {
            fallback.style.display = 'block';
          }
        }}
      />
      {/* Fallback text (hidden by default, shown if image fails to load) */}
      <span 
        className={`font-bold text-white ${
          size === 'small' ? 'text-xl' : 
          size === 'large' ? 'text-4xl' : 'text-2xl'
        }`}
        style={{ display: 'none' }}
      >
        SRT Subtitle Editor
      </span>
    </div>
  );
};

export default Logo;
