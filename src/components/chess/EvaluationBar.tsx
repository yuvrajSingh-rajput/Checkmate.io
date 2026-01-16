import { cn } from '@/lib/utils';
import { CSSProperties } from 'react';

interface EvaluationBarProps {
  evaluation: number;
  isFlipped?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function EvaluationBar({ evaluation, isFlipped = false, className, style }: EvaluationBarProps) {
  // Convert evaluation (-100 to 100 for mate) to percentage (0-100)
  // Clamp to reasonable range
  const clampedEval = Math.max(-10, Math.min(10, evaluation));
  
  // Calculate white's percentage (50% is equal, 100% is winning for white)
  const whitePercent = 50 + (clampedEval / 10) * 50;
  
  // When flipped, we need to invert the visual (white on top when flipped)
  const displayPercent = isFlipped ? (100 - whitePercent) : whitePercent;
  
  const displayEval = Math.abs(evaluation) >= 100
    ? (evaluation > 0 ? '+M' : '-M')
    : (evaluation > 0 ? `+${evaluation.toFixed(1)}` : evaluation.toFixed(1));

  // Determine text position based on who's winning and board orientation
  const isWhiteWinning = evaluation >= 0;
  const textOnBottom = isFlipped ? !isWhiteWinning : isWhiteWinning;

  return (
    <div className={cn('relative w-7 rounded-md overflow-hidden border border-border/30', className)} style={style}>
      {/* Top side */}
      <div 
        className={cn(
          'absolute top-0 left-0 right-0 transition-all duration-500 ease-out',
          isFlipped ? 'bg-eval-white' : 'bg-eval-black'
        )}
        style={{ height: `${100 - displayPercent}%` }}
      />
      
      {/* Bottom side */}
      <div 
        className={cn(
          'absolute bottom-0 left-0 right-0 transition-all duration-500 ease-out',
          isFlipped ? 'bg-eval-black' : 'bg-eval-white'
        )}
        style={{ height: `${displayPercent}%` }}
      />
      
      {/* Evaluation text */}
      <div 
        className={cn(
          'absolute left-1/2 -translate-x-1/2 text-[10px] font-bold px-0.5 transition-all duration-500 whitespace-nowrap',
          textOnBottom ? 'bottom-1 text-background' : 'top-1 text-foreground'
        )}
      >
        {displayEval}
      </div>
      
      {/* Center line */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-border/50" />
    </div>
  );
}