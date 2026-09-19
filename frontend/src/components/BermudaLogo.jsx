import React from 'react';

export default function BermudaLogo({ size = 'md', variant = 'dashboard', className = '' }) {
  const sizeClasses = {
    sm: 'w-24 sm:w-28',
    md: 'w-36 sm:w-44',
    lg: 'w-44 sm:w-52',
    xl: 'w-56 sm:w-64',
  };

  const logoSrc = variant === 'login' ? '/login_logo.png' : '/dashboard_logo.png';

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <div className="relative rounded-xl bg-transparent p-1 overflow-hidden group">
        <img
          src={logoSrc}
          alt="The BerMuda - A Cocktail Commune"
          className={`${sizeClasses[size] || sizeClasses.md} h-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-lg`}
        />
      </div>
    </div>
  );
}
