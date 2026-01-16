import { cn } from '@/lib/utils';
import { CLASSIFICATION_CONFIG, type MoveClassification } from '@/types/chess';

interface MoveClassificationBadgeProps {
  classification: MoveClassification;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function MoveClassificationBadge({ 
  classification, 
  size = 'md',
  showLabel = false,
  className 
}: MoveClassificationBadgeProps) {
  const config = CLASSIFICATION_CONFIG[classification];
  
  const sizeClasses = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm',
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div 
        className={cn(
          'rounded-full flex items-center justify-center font-bold animate-bounce-in',
          sizeClasses[size],
          config.bgClass,
          'text-background'
        )}
        title={config.label}
      >
        {config.symbol}
      </div>
      {showLabel && (
        <span className={cn('text-xs font-medium', config.textClass)}>
          {config.label}
        </span>
      )}
    </div>
  );
}
