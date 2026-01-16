import { cn } from '@/lib/utils';
import { Crown } from 'lucide-react';

interface PlayerBarProps {
  name: string;
  elo?: number;
  isWhite: boolean;
  isActive?: boolean;
  accuracy?: number;
  className?: string;
}

export function PlayerBar({ name, elo, isWhite, isActive, accuracy, className }: PlayerBarProps) {
  return (
    <div 
      className={cn(
        'flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200',
        isActive ? 'bg-secondary ring-1 ring-primary/30' : 'bg-card',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {/* Player piece indicator */}
        <div 
          className={cn(
            'w-8 h-8 rounded flex items-center justify-center text-xl font-bold',
            isWhite ? 'bg-eval-white text-background' : 'bg-eval-black text-foreground'
          )}
        >
          {isWhite ? '♔' : '♚'}
        </div>
        
        {/* Player info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{name}</span>
            {isActive && <Crown className="w-3 h-3 text-primary animate-pulse-slow" />}
          </div>
          {elo && (
            <span className="text-xs text-muted-foreground">{elo}</span>
          )}
        </div>
      </div>
      
      {/* Accuracy */}
      {accuracy !== undefined && (
        <div className="flex items-center gap-2">
          <div 
            className={cn(
              'text-sm font-bold px-2 py-1 rounded',
              accuracy >= 90 ? 'bg-move-best/20 text-move-best' :
              accuracy >= 70 ? 'bg-move-good/20 text-move-good' :
              accuracy >= 50 ? 'bg-move-inaccuracy/20 text-move-inaccuracy' :
              'bg-move-blunder/20 text-move-blunder'
            )}
          >
            {accuracy}%
          </div>
        </div>
      )}
    </div>
  );
}
