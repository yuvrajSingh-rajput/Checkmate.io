import { useEffect, useRef, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { MoveClassificationBadge } from './MoveClassificationBar';
import { ChevronRight, BookOpen } from 'lucide-react';
import type { AnalyzedMove, EngineLine } from '@/types/chess';

interface MoveListProps {
  moves: AnalyzedMove[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
  className?: string;
}

// --- Helper Functions ---

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
  return san.replace(/^[KQRBN]/, '');
}

function formatEvaluation(evaluation: { type: 'cp' | 'mate'; value: number }): string {
  if (evaluation.type === 'mate') {
    return `M${evaluation.value > 0 ? '+' : ''}${evaluation.value}`;
  }
  return evaluation.value > 0 ? `+${evaluation.value}` : `${evaluation.value}`;
}

// --- Sub-Components ---

function EngineLinesDisplay({ engineLines }: { engineLines?: EngineLine[] }) {
  if (!engineLines || engineLines.length === 0) return (
    <div className="text-xs text-muted-foreground italic p-2">No engine analysis available</div>
  );
  
  return (
    <div className="space-y-1">
      {engineLines.map((line) => (
        <div key={line.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs p-1.5 rounded bg-background border border-border/50">
          <div className="flex items-center gap-1 min-w-[3rem]">
            <span className={cn(
              'font-mono font-medium',
              line.evaluation.type === 'mate' 
                ? 'text-purple-600' 
                : line.evaluation.value > 0 
                  ? 'text-emerald-600' 
                  : 'text-rose-600'
            )}>
              {formatEvaluation(line.evaluation)}
            </span>
          </div>
          
          <div className="font-mono text-foreground/90 truncate">
            {line.moveSAN || line.moveUCI}
            {/* Optional: Add PV (Principal Variation) text here if available */}
          </div>

          <div className="text-muted-foreground/70 text-[10px]">
            d{line.depth}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveMoveDetails({ move }: { move?: AnalyzedMove }) {
  if (!move) {
    return (
      <div className="p-4 border-b bg-muted/10 text-center">
        <span className="text-sm text-muted-foreground font-medium">Starting Position</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-b bg-muted/10">
      {/* Opening Header */}
      {move.opening && (
        <div className="px-3 py-2 border-b border-border/50 bg-blue-50/50 dark:bg-blue-900/10 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate">
            {move.opening}
          </span>
        </div>
      )}

      {/* Engine Analysis */}
      <div className="p-2 bg-card/50">
        <EngineLinesDisplay engineLines={move.engineLines} />
      </div>
    </div>
  );
}

interface MoveButtonProps {
  move: AnalyzedMove;
  isActive: boolean;
  onClick: () => void;
}

const MoveButton = forwardRef<HTMLButtonElement, MoveButtonProps>(
  ({ move, isActive, onClick }, ref) => {
    const pieceIcon = getPieceIcon(move.san);
    const formattedMove = formatMove(move.san);

    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          'relative flex items-center justify-between flex-1 px-2 py-1.5 text-sm transition-colors rounded-sm',
          isActive 
            ? 'bg-primary text-primary-foreground font-semibold shadow-sm' 
            : 'hover:bg-muted text-foreground'
        )}
      >
        <div className="flex items-center gap-1.5">
          {pieceIcon && (
            <span className={cn("text-base opacity-90", isActive ? "text-primary-foreground" : "text-foreground")}>
              {pieceIcon}
            </span>
          )}
          <span className="font-mono">{formattedMove}</span>
        </div>
        
        {/* Pass a specialized class to badge if active to handle contrast */}
        <MoveClassificationBadge 
          classification={move.classification}
          size="sm"
        />
      </button>
    );
  }
);

MoveButton.displayName = 'MoveButton';

// --- Main Component ---

export function MoveList({ moves, currentMoveIndex, onMoveClick, className }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : undefined;

  // Auto-scroll to current move
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentMoveIndex]);

  // Group moves into pairs
  const movePairs: [AnalyzedMove | undefined, AnalyzedMove | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i], moves[i + 1]]);
  }

  return (
    <div className={cn("flex flex-col h-full bg-background border rounded-lg shadow-sm overflow-hidden", className)}>
      
      {/* Top Section: Active Analysis (Fixed) */}
      <div className="flex-none z-10 shadow-sm">
        <ActiveMoveDetails move={currentMove} />
      </div>

      {/* Bottom Section: Scrollable Move History */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent p-2"
      >
        <div className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5 auto-rows-max">
          {movePairs.map((pair, pairIndex) => {
            const [whiteMove, blackMove] = pair;
            const moveNumber = pairIndex + 1;

            return (
              <div key={pairIndex} className="contents group">
                {/* Move Number */}
                <div className="flex items-center justify-center text-xs text-muted-foreground font-mono bg-muted/20 my-0.5 rounded-l-sm">
                  {moveNumber}.
                </div>

                {/* White Move */}
                <div className="my-0.5">
                  {whiteMove ? (
                    <MoveButton
                      ref={currentMoveIndex === pairIndex * 2 ? activeRef : null}
                      move={whiteMove}
                      isActive={currentMoveIndex === pairIndex * 2}
                      onClick={() => onMoveClick(pairIndex * 2)}
                    />
                  ) : (
                    <div className="h-full bg-muted/5" />
                  )}
                </div>

                {/* Black Move */}
                <div className="my-0.5">
                  {blackMove ? (
                    <MoveButton
                      ref={currentMoveIndex === pairIndex * 2 + 1 ? activeRef : null}
                      move={blackMove}
                      isActive={currentMoveIndex === pairIndex * 2 + 1}
                      onClick={() => onMoveClick(pairIndex * 2 + 1)}
                    />
                  ) : (
                    <div className="h-full bg-muted/5 rounded-r-sm" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {moves.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            No moves yet
          </div>
        )}
      </div>
    </div>
  );
}