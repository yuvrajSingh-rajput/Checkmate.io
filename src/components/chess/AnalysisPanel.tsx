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

const SAMPLE_PGN = `[Event "Opera Game"]
[Site "Paris, France"]
[Date "1858.??.??"]
[Round "?"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

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
