import { useEffect, useState } from 'react';
import { 
  ChevronFirst, 
  ChevronLast, 
  ChevronLeft, 
  ChevronRight, 
  Play,
  Pause
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavigationControlsProps {
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  className?: string;
}

export function NavigationControls({
  onFirst,
  onPrevious,
  onNext,
  onLast,
  canGoPrevious,
  canGoNext,
  className,
}: NavigationControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      if (canGoNext) {
        onNext();
      } else {
        setIsPlaying(false);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlaying, canGoNext, onNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          onPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          onNext();
          break;
        case 'Home':
          e.preventDefault();
          onFirst();
          break;
        case 'End':
          e.preventDefault();
          onLast();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(p => !p);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFirst, onPrevious, onNext, onLast]);

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={onFirst}
        disabled={!canGoPrevious}
        className="h-10 w-10 hover:bg-secondary"
        title="First move (Home)"
      >
        <ChevronFirst className="h-5 w-5" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="h-10 w-10 hover:bg-secondary"
        title="Previous move (←)"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      
      <Button
        variant={isPlaying ? 'default' : 'ghost'}
        size="icon"
        onClick={() => setIsPlaying(!isPlaying)}
        disabled={!canGoNext && !isPlaying}
        className="h-10 w-10"
        title="Play/Pause (Space)"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={!canGoNext}
        className="h-10 w-10 hover:bg-secondary"
        title="Next move (→)"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onLast}
        disabled={!canGoNext}
        className="h-10 w-10 hover:bg-secondary"
        title="Last move (End)"
      >
        <ChevronLast className="h-5 w-5" />
      </Button>
    </div>
  );
}
