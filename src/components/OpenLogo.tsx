import React from 'react';
import logoWhite from '@/assets/logo-white.png';

const OpenLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <img src={logoWhite} alt="OPEN Datacenter" className="h-10 w-auto" />
      <div className="flex flex-col">
        <span className="text-2xl font-bold tracking-wider text-foreground">OPEN</span>
        <span className="text-[10px] tracking-[0.3em] text-muted-foreground uppercase">Datacenter</span>
      </div>
    </div>
  );
};

export default OpenLogo;
