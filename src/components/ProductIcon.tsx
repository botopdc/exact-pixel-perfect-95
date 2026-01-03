import React from 'react';
import { cn } from '@/lib/utils';

export type ProductIconType = 
  | 'vm'
  | 'baremetal'
  | 'kubernetes'
  | 'database'
  | 'storage-volume'
  | 'storage-s3'
  | 'storage-nvme'
  | 'snapshots'
  | 'open-saas';

interface ProductIconProps {
  type: ProductIconType;
  size?: number;
  className?: string;
}

const iconPaths: Record<ProductIconType, React.ReactNode> = {
  // VM: Simple server/rack icon
  'vm': (
    <>
      <rect x="4" y="3" width="16" height="6" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <rect x="4" y="11" width="16" height="6" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="7" cy="6" r="1" fill="currentColor" />
      <circle cx="7" cy="14" r="1" fill="currentColor" />
      <line x1="10" y1="6" x2="17" y2="6" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="10" y1="14" x2="17" y2="14" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="21" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="8" y1="21" x2="16" y2="21" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
  
  // BareMetal: Physical server chassis icon
  'baremetal': (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <line x1="3" y1="9" x2="21" y2="9" strokeWidth="1.5" stroke="currentColor" />
      <line x1="3" y1="14" x2="21" y2="14" strokeWidth="1.5" stroke="currentColor" />
      <circle cx="6" cy="6.5" r="1" fill="currentColor" />
      <circle cx="6" cy="11.5" r="1" fill="currentColor" />
      <circle cx="6" cy="16.5" r="1" fill="currentColor" />
      <line x1="9" y1="6.5" x2="18" y2="6.5" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="9" y1="11.5" x2="18" y2="11.5" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="9" y1="16.5" x2="14" y2="16.5" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
  
  // Kubernetes: Hexagon/wheel cluster icon
  'kubernetes': (
    <>
      <circle cx="12" cy="12" r="9" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="3" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <line x1="12" y1="3" x2="12" y2="9" strokeWidth="1.5" stroke="currentColor" />
      <line x1="12" y1="15" x2="12" y2="21" strokeWidth="1.5" stroke="currentColor" />
      <line x1="4.22" y1="7.5" x2="9.4" y2="10.5" strokeWidth="1.5" stroke="currentColor" />
      <line x1="14.6" y1="13.5" x2="19.78" y2="16.5" strokeWidth="1.5" stroke="currentColor" />
      <line x1="4.22" y1="16.5" x2="9.4" y2="13.5" strokeWidth="1.5" stroke="currentColor" />
      <line x1="14.6" y1="10.5" x2="19.78" y2="7.5" strokeWidth="1.5" stroke="currentColor" />
    </>
  ),
  
  // Database: Classic cylinder icon
  'database': (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <path d="M4 10c0 1.66 3.58 3 8 3s8-1.34 8-3" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <path d="M4 15c0 1.66 3.58 3 8 3s8-1.34 8-3" strokeWidth="1.5" fill="none" stroke="currentColor" />
    </>
  ),
  
  // Storage Volume: Hard disk drive icon
  'storage-volume': (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="4" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="17" cy="9" r="1" fill="currentColor" />
    </>
  ),
  
  // Storage S3: Bucket/container icon
  'storage-s3': (
    <>
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3H3V5z" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="8" y1="15" x2="14" y2="15" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
  
  // Storage NVMe: Fast SSD with speed lines
  'storage-nvme': (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <rect x="6" y="9" width="8" height="6" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <line x1="17" y1="9" x2="17" y2="15" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <line x1="8" y1="11" x2="12" y2="11" strokeWidth="1" stroke="currentColor" strokeLinecap="round" />
      <line x1="8" y1="13" x2="11" y2="13" strokeWidth="1" stroke="currentColor" strokeLinecap="round" />
      <path d="M20 8l2-2" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M20 12l2 0" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M20 16l2 2" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
  
  // Snapshots: Camera/checkpoint icon
  'snapshots': (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="12" cy="13" r="4" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" />
      <circle cx="17" cy="9" r="1" fill="currentColor" />
    </>
  ),
  
  // OPEN SaaS: App/grid/layers icon
  'open-saas': (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <rect x="3" y="13" width="8" height="8" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <rect x="13" y="13" width="8" height="8" rx="1" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
      <circle cx="17" cy="7" r="1.5" fill="currentColor" />
      <circle cx="7" cy="17" r="1.5" fill="currentColor" />
      <line x1="15" y1="17" x2="19" y2="17" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" />
    </>
  ),
};

export const ProductIcon: React.FC<ProductIconProps> = ({ 
  type, 
  size = 20, 
  className 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('text-muted-foreground shrink-0', className)}
    >
      {iconPaths[type]}
    </svg>
  );
};

export default ProductIcon;
