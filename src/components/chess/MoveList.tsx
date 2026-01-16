import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MoveClassificationBadge } from './MoveClassificationBar';
import type { AnalyzedMove } from '@/types/chess';

interface MoveListProps {
  moves: AnalyzedMove[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  className?: string;
}

function getPieceIcon(san: string): string {
  if (san.startsWith('K')) return '♔';
  if (san.startsWith('Q')) return '♕';
  if (san.startsWith('R')) return '♖';
  if (san.startsWith('B')) return '♗';
  if (san.startsWith('N')) return '♘';
  if (san === 'O-O' || san === 'O-O-O') return '♔';
  return '';
}

function formatMove(san: string): string {
  // Remove piece letters since we show icons
  return san.replace(/^[KQRBN]/, '');
}

export function MoveList({ moves, currentMoveIndex, onMoveClick, className }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to current move
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentMoveIndex]);

  // Group moves into pairs (white + black)
  const movePairs: [AnalyzedMove | undefined, AnalyzedMove | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div 
      ref={scrollRef}
      className={cn(
        'overflow-y-auto scrollbar-thin',
        className
      )}
    >
      <div className="space-y-0.5 p-2">
        {movePairs.map((pair, pairIndex) => {
          const [whiteMove, blackMove] = pair;
          const moveNumber = pairIndex + 1;

          return (
            <div 
              key={pairIndex}
              className="flex items-stretch gap-1 animate-fade-in"
              style={{ animationDelay: `${pairIndex * 20}ms` }}
            >
              {/* Move number */}
              <div className="w-8 flex-shrink-0 text-muted-foreground text-sm font-mono py-1.5">
                {moveNumber}.
              </div>

              {/* White move */}
              {whiteMove && (
                <MoveButton
                  ref={currentMoveIndex === pairIndex * 2 ? activeRef : null}
                  move={whiteMove}
                  isActive={currentMoveIndex === pairIndex * 2}
                  onClick={() => onMoveClick(pairIndex * 2)}
                />
              )}

              {/* Black move */}
              {blackMove && (
                <MoveButton
                  ref={currentMoveIndex === pairIndex * 2 + 1 ? activeRef : null}
                  move={blackMove}
                  isActive={currentMoveIndex === pairIndex * 2 + 1}
                  onClick={() => onMoveClick(pairIndex * 2 + 1)}
                />
              )}

              {/* Empty space if no black move */}
              {!blackMove && <div className="flex-1" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MoveButtonProps {
  move: AnalyzedMove;
  isActive: boolean;
  onClick: () => void;
}

import { forwardRef } from 'react';

const MoveButton = forwardRef<HTMLButtonElement, MoveButtonProps>(
  ({ move, isActive, onClick }, ref) => {
    const pieceIcon = getPieceIcon(move.san);
    const formattedMove = formatMove(move.san);

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          'flex-1 flex items-center justify-between px-2 py-1.5 rounded text-sm transition-all duration-150',
          'hover:bg-secondary/80',
          isActive 
            ? 'bg-primary/20 ring-1 ring-primary/40' 
            : 'bg-card hover:bg-secondary'
        )}
      >
        <div className="flex items-center gap-1">
          {pieceIcon && (
            <span className="text-base">{pieceIcon}</span>
          )}
          <span className={cn(
            'font-mono',
            isActive ? 'text-foreground font-semibold' : 'text-foreground/80'
          )}>
            {formattedMove}
          </span>
        </div>
        
        <MoveClassificationBadge 
          classification={move.classification}
          size="sm"
        />
      </button>
    );
  }
);

MoveButton.displayName = 'MoveButton';
