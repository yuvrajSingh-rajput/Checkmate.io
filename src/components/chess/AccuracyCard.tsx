import { cn } from '@/lib/utils';

interface AccuracyCardProps {
  label: string;
  accuracy: number;
  isWhite: boolean;
  className?: string;
}

export function AccuracyCard({ label, accuracy, isWhite, className }: AccuracyCardProps) {
  const getAccuracyColor = (acc: number) => {
    if (acc >= 95) return 'from-move-brilliant to-move-best';
    if (acc >= 85) return 'from-move-best to-move-good';
    if (acc >= 70) return 'from-move-good to-move-inaccuracy';
    if (acc >= 50) return 'from-move-inaccuracy to-move-mistake';
    return 'from-move-mistake to-move-blunder';
  };

  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-xl p-4',
        'bg-gradient-to-br',
        getAccuracyColor(accuracy),
        className
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-4 -top-4 text-8xl">
          {isWhite ? '♔' : '♚'}
        </div>
      </div>
      
      <div className="relative">
        <div className="text-sm font-medium text-background/80 mb-1">
          {label}
        </div>
        <div className="text-3xl font-bold text-background">
          {accuracy}%
        </div>
        <div className="text-xs text-background/60 mt-1">
          Accuracy
        </div>
      </div>
    </div>
  );
}
