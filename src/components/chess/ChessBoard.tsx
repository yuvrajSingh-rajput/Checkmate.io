import { useMemo, useState, useEffect } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EvaluationBar } from './EvaluationBar';
import { PlayerBar } from './PlayerBar';
import type { AnalyzedMove, GameInfo } from '@/types/chess';
import { CLASSIFICATION_CONFIG } from '@/types/chess';

interface ChessBoardComponentProps {
  moves: AnalyzedMove[];
  currentMoveIndex: number;
  gameInfo: GameInfo;
  whiteAccuracy?: number;
  blackAccuracy?: number;
  className?: string;
}

export function ChessBoard({
  moves,
  currentMoveIndex,
  gameInfo,
  whiteAccuracy,
  blackAccuracy,
  className,
}: ChessBoardComponentProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [boardWidth, setBoardWidth] = useState(480);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      if (isFullscreen) {
        setBoardWidth(Math.min(window.innerWidth, window.innerHeight) - 200);
      } else {
        setBoardWidth(Math.min(480, window.innerWidth - 80));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isFullscreen]);

  const currentFen = useMemo(() => {
    if (currentMoveIndex < 0 || moves.length === 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    }
    return moves[currentMoveIndex]?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }, [moves, currentMoveIndex]);

  const currentEval = useMemo(() => {
    if (currentMoveIndex < 0 || moves.length === 0) return 0;
    return moves[currentMoveIndex]?.evaluation || 0;
  }, [moves, currentMoveIndex]);

  const currentMateIn = useMemo(() => {
    if (currentMoveIndex < 0 || moves.length === 0) return undefined;
    return moves[currentMoveIndex]?.mateIn;
  }, [moves, currentMoveIndex]);

  const currentMove = currentMoveIndex >= 0 ? moves[currentMoveIndex] : null;

  const chess = useMemo(() => new Chess(currentFen), [currentFen]);
  const isWhiteTurn = chess.turn() === 'w';

  // Square styles for highlighting the last move
  const squareStyles = useMemo(() => {
    if (!currentMove) return {};
    
    return {
      [currentMove.from]: { backgroundColor: 'rgba(255, 170, 0, 0.4)' },
      [currentMove.to]: { backgroundColor: 'rgba(255, 170, 0, 0.5)' },
    };
  }, [currentMove]);

  // Calculate classification badge position on the destination square
  const classificationBadgePosition = useMemo(() => {
    if (!currentMove || currentMove.classification === 'book' || currentMove.classification === 'forced') {
      return null;
    }

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const toFile = files.indexOf(currentMove.to[0]);
    const toRank = parseInt(currentMove.to[1]) - 1;
    
    const squareSize = boardWidth / 8;
    
    // Calculate pixel position based on orientation
    let left: number;
    let top: number;
    
    if (isFlipped) {
      // When flipped: a1 is top-right, h8 is bottom-left
      left = (7 - toFile) * squareSize + squareSize - 12;
      top = (toRank) * squareSize - 6;
    } else {
      // Normal: a1 is bottom-left, h8 is top-right
      left = toFile * squareSize + squareSize - 12;
      top = (7 - toRank) * squareSize - 6;
    }

    return { left, top };
  }, [currentMove, boardWidth, isFlipped]);

  // Calculate best move arrow coordinates
  const bestMoveArrow = useMemo(() => {
    if (!currentMove?.bestMove || currentMove.bestMove === `${currentMove.from}${currentMove.to}`) {
      return null;
    }

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const bestFrom = currentMove.bestMove.slice(0, 2);
    const bestTo = currentMove.bestMove.slice(2, 4);
    
    const fromFile = files.indexOf(bestFrom[0]);
    const fromRank = parseInt(bestFrom[1]) - 1;
    const toFile = files.indexOf(bestTo[0]);
    const toRank = parseInt(bestTo[1]) - 1;
    
    const squareSize = boardWidth / 8;
    
    let x1: number, y1: number, x2: number, y2: number;
    
    if (isFlipped) {
      x1 = (7 - fromFile) * squareSize + squareSize / 2;
      y1 = fromRank * squareSize + squareSize / 2;
      x2 = (7 - toFile) * squareSize + squareSize / 2;
      y2 = toRank * squareSize + squareSize / 2;
    } else {
      x1 = fromFile * squareSize + squareSize / 2;
      y1 = (7 - fromRank) * squareSize + squareSize / 2;
      x2 = toFile * squareSize + squareSize / 2;
      y2 = (7 - toRank) * squareSize + squareSize / 2;
    }
    
    // Shorten arrow to not overlap pieces
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const unitX = dx / length;
    const unitY = dy / length;
    
    return {
      x1: x1 + unitX * 15,
      y1: y1 + unitY * 15,
      x2: x2 - unitX * 25,
      y2: y2 - unitY * 25,
    };
  }, [currentMove, boardWidth, isFlipped]);

  // Player bars based on orientation
  const topPlayer = isFlipped ? gameInfo.white : gameInfo.black;
  const topElo = isFlipped ? gameInfo.whiteElo : gameInfo.blackElo;
  const topAccuracy = isFlipped ? whiteAccuracy : blackAccuracy;
  const topIsWhite = isFlipped;
  
  const bottomPlayer = isFlipped ? gameInfo.black : gameInfo.white;
  const bottomElo = isFlipped ? gameInfo.blackElo : gameInfo.whiteElo;
  const bottomAccuracy = isFlipped ? blackAccuracy : whiteAccuracy;
  const bottomIsWhite = !isFlipped;

  return (
    <div className={cn('flex flex-col gap-3', isFullscreen && 'fixed inset-0 z-50 bg-background p-6 flex items-center justify-center', className)}>
      <PlayerBar 
        name={topPlayer} 
        elo={topElo} 
        isWhite={topIsWhite} 
        isActive={topIsWhite ? isWhiteTurn : !isWhiteTurn} 
        accuracy={topAccuracy} 
      />

      <div className="flex gap-3 items-stretch">
        <EvaluationBar 
          evaluation={currentEval} 
          mateIn={currentMateIn}
          isFlipped={isFlipped}
          className="min-h-[300px]" 
          style={{ height: boardWidth }} 
        />

        <div className="relative">
          <div className="chess-board-container rounded-lg overflow-hidden shadow-2xl">
            <Chessboard
              position={currentFen}
              width={boardWidth}
              orientation={isFlipped ? 'black' : 'white'}
              draggable={false}
              squareStyles={squareStyles}
              boardStyle={{ borderRadius: '8px' }}
              darkSquareStyle={{ backgroundColor: 'hsl(145, 45%, 38%)' }}
              lightSquareStyle={{ backgroundColor: 'hsl(35, 35%, 85%)' }}
              transitionDuration={200}
            />

            {/* Best move arrow overlay */}
            {bestMoveArrow && (
              <svg 
                className="absolute inset-0 pointer-events-none"
                width={boardWidth}
                height={boardWidth}
                style={{ zIndex: 5 }}
              >
                <defs>
                  <filter id="arrow-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4"/>
                  </filter>
                </defs>
                
                {/* Arrow line */}
                <line
                  x1={bestMoveArrow.x1}
                  y1={bestMoveArrow.y1}
                  x2={bestMoveArrow.x2}
                  y2={bestMoveArrow.y2}
                  stroke="hsl(145, 63%, 49%)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  opacity="0.85"
                  filter="url(#arrow-shadow)"
                />
                
                {/* Arrow head */}
                <polygon
                  points={(() => {
                    const dx = bestMoveArrow.x2 - bestMoveArrow.x1;
                    const dy = bestMoveArrow.y2 - bestMoveArrow.y1;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const ux = dx / len;
                    const uy = dy / len;
                    const px = -uy;
                    const py = ux;
                    
                    const tipX = bestMoveArrow.x2 + ux * 16;
                    const tipY = bestMoveArrow.y2 + uy * 16;
                    const b1X = bestMoveArrow.x2 + px * 10;
                    const b1Y = bestMoveArrow.y2 + py * 10;
                    const b2X = bestMoveArrow.x2 - px * 10;
                    const b2Y = bestMoveArrow.y2 - py * 10;
                    
                    return `${tipX},${tipY} ${b1X},${b1Y} ${b2X},${b2Y}`;
                  })()}
                  fill="hsl(145, 63%, 49%)"
                  opacity="0.85"
                  filter="url(#arrow-shadow)"
                />
              </svg>
            )}

            {/* Classification badge on the moved piece */}
            {classificationBadgePosition && currentMove && (
              <div 
                className="absolute pointer-events-none animate-bounce-in"
                style={{ 
                  left: `${classificationBadgePosition.left}px`,
                  top: `${classificationBadgePosition.top}px`,
                  zIndex: 15 
                }}
              >
                <div 
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white border-2 border-white/50',
                    CLASSIFICATION_CONFIG[currentMove.classification].bgClass
                  )}
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
                >
                  {CLASSIFICATION_CONFIG[currentMove.classification].symbol}
                </div>
              </div>
            )}
          </div>

          {/* Control buttons - outside board, bottom right corner */}
          <div className="flex gap-2 mt-2 justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFlipped(!isFlipped)}
              className="h-8 px-3"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Flip
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="h-8 px-3"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1.5" /> : <Maximize2 className="h-4 w-4 mr-1.5" />}
              {isFullscreen ? "Exit" : "Fullscreen"}
            </Button>
          </div>
        </div>
      </div>

      <PlayerBar 
        name={bottomPlayer} 
        elo={bottomElo} 
        isWhite={bottomIsWhite} 
        isActive={bottomIsWhite ? isWhiteTurn : !isWhiteTurn} 
        accuracy={bottomAccuracy} 
      />
    </div>
  );
}