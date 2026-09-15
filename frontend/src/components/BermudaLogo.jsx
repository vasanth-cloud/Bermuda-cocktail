import React from 'react';

export default function BermudaLogo({ size = 'md', className = '' }) {
  // Responsive width presets for logo card
  const sizeClasses = {
    sm: 'w-24 sm:w-28',
    md: 'w-36 sm:w-44',
    lg: 'w-44 sm:w-52',
    xl: 'w-56 sm:w-64',
  };

  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${className}`}>
      <div className="relative rounded-xl bg-slate-950 p-1.5 border border-amber-500/40 shadow-lg shadow-amber-500/10 overflow-hidden group">
        <img
          src="/bermuda_brand_card.png"
          alt="The BerMuda - A Cocktail Commune"
          className={`${sizeClasses[size] || sizeClasses.md} h-auto object-contain rounded-lg transition-transform duration-300 group-hover:scale-105`}
        />
      </div>
    </div>
  );
}
