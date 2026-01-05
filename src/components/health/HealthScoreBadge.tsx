import { HEALTH_STATUS_CONFIG, HealthStatus } from '@/types/healthScore';
import { cn } from '@/lib/utils';

interface HealthScoreBadgeProps {
  score: number;
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function HealthScoreBadge({ score, status, size = 'md', showLabel = true }: HealthScoreBadgeProps) {
  const config = HEALTH_STATUS_CONFIG[status];
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };
  
  const statusColors = {
    saudavel: 'bg-green-500',
    atencao: 'bg-yellow-500',
    risco: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div 
        className={cn(
          'rounded-full flex items-center justify-center font-bold text-white',
          sizeClasses[size],
          statusColors[status]
        )}
      >
        {score}
      </div>
      {showLabel && (
        <span className={cn('font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
