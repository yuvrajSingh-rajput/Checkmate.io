import { useState } from 'react';
import { FileText, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { AccuracyCard } from './AccuracyCard';
import { MoveList } from './MoveList';
import { NavigationControls } from './NavigationControl';
import { cn } from '@/lib/utils';
import type { AnalyzedMove, GameInfo } from '@/types/chess';

interface AnalysisPanelProps {
  moves: AnalyzedMove[];
  currentMoveIndex: number;
  isAnalyzing: boolean;
  progress: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  gameInfo: GameInfo;
  onAnalyze: (pgn: string) => void;
  onStopAnalysis: () => void;
  onMoveClick: (index: number) => void;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  className?: string;
}

const SAMPLE_PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.15"]
[White "Magnus"]
[Black "Hikaru"]
[WhiteElo "2850"]
[BlackElo "2800"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. Nf1 Bf8 14. Ng3 g6 15. a4 c5 16. d5 c4 17. Bg5 h6 18. Be3 Nc5 19. Qd2 h5 20. Bg5 Be7 21. Rf1 Nh7 22. Be3 Rf8 23. Nh2 Bg5 24. Bxg5 Nxg5 25. Qe3 Qf6 26. f4 exf4 27. Qxf4 Qxf4 28. Rxf4 Ne6 29. Rf2 Ng5 30. Raf1 Rae8 31. Nf3 Nxf3+ 32. Rxf3 Nd3 33. Bxd3 cxd3 34. Rxd3 bxa4 35. Rdf3 Rxf3 36. Rxf3 Bc8 37. Rc3 Kf8 38. Nf1 Ke7 39. Ne3 Kd8 40. Kf2 Rf8+ 41. Kg3 Rf4 42. Nc4 Rxe4 43. Nxd6 Rd4 44. c4 1-0`;

export function AnalysisPanel({
  moves,
  currentMoveIndex,
  isAnalyzing,
  progress,
  whiteAccuracy,
  blackAccuracy,
  gameInfo,
  onAnalyze,
  onStopAnalysis,
  onMoveClick,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  className,
}: AnalysisPanelProps) {
  const [pgn, setPgn] = useState('');

  const handleAnalyze = () => {
    const pgnToAnalyze = pgn.trim() || SAMPLE_PGN;
    onAnalyze(pgnToAnalyze);
  };

  const hasAnalysis = moves.length > 0;

  return (
    <div className={cn('flex flex-col h-full bg-card rounded-xl border border-border', className)}>
      {/* PGN Input Section */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileText className="h-4 w-4" />
          Paste PGN
        </div>
        
        <Textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder="Paste your PGN here or click Analyze for a sample game..."
          className="min-h-[80px] text-xs font-mono resize-none bg-background"
          disabled={isAnalyzing}
        />
        
        {isAnalyzing ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing with Stockfish...
              </span>
              <span className="text-primary font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onStopAnalysis}
              className="w-full"
            >
              Stop Analysis
            </Button>
          </div>
        ) : (
          <Button 
            onClick={handleAnalyze}
            className="w-full gap-2"
            size="sm"
          >
            <Sparkles className="h-4 w-4" />
            Analyze Game
          </Button>
        )}
      </div>

      {/* Analysis Content */}
      {hasAnalysis && (
        <>
          {/* Accuracy Cards */}
          <div className="p-4 border-b border-border">
            <div className="grid grid-cols-2 gap-3">
              <AccuracyCard
                label={gameInfo.white}
                accuracy={whiteAccuracy}
                isWhite={true}
              />
              <AccuracyCard
                label={gameInfo.black}
                accuracy={blackAccuracy}
                isWhite={false}
              />
            </div>
          </div>

          {/* Move List */}
          <MoveList
            moves={moves}
            currentMoveIndex={currentMoveIndex}
            onMoveClick={onMoveClick}
            className="flex-1 min-h-0"
          />

          {/* Navigation Controls */}
          <div className="p-3 border-t border-border bg-muted/30">
            <NavigationControls
              onFirst={onFirst}
              onPrevious={onPrevious}
              onNext={onNext}
              onLast={onLast}
              canGoPrevious={currentMoveIndex > -1}
              canGoNext={currentMoveIndex < moves.length - 1}
            />
          </div>
        </>
      )}

      {/* Empty state */}
      {!hasAnalysis && !isAnalyzing && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <div className="text-4xl">♟️</div>
            <p className="text-muted-foreground text-sm">
              Paste a PGN to analyze your game
            </p>
            <p className="text-muted-foreground/70 text-xs">
              Or click Analyze for a sample game
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
