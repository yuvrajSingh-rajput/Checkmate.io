import { useStockfishAnalysis } from '@/hooks/useStockfishAnalysis';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { AnalysisPanel } from '@/components/chess/AnalysisPanel';

const Index = () => {
  const {
    moves,
    currentMoveIndex,
    isAnalyzing,
    progress,
    whiteAccuracy,
    blackAccuracy,
    gameInfo,
    analyzePGN,
    stopAnalysis,
    goToMove,
    goFirst,
    goPrevious,
    goNext,
    goLast,
  } = useStockfishAnalysis();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-2xl">♟️</div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Chess Analysis Board</h1>
              <p className="text-xs text-muted-foreground">Powered by Stockfish</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-center">
          {/* Chess Board Section */}
          <div className="w-full lg:w-auto flex justify-center">
            <ChessBoard
              moves={moves}
              currentMoveIndex={currentMoveIndex}
              gameInfo={gameInfo}
              whiteAccuracy={moves.length > 0 ? whiteAccuracy : undefined}
              blackAccuracy={moves.length > 0 ? blackAccuracy : undefined}
            />
          </div>

          {/* Analysis Panel */}
          <div className="w-full lg:w-[360px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-20">
            <AnalysisPanel
              moves={moves}
              currentMoveIndex={currentMoveIndex}
              isAnalyzing={isAnalyzing}
              progress={progress}
              whiteAccuracy={whiteAccuracy}
              blackAccuracy={blackAccuracy}
              gameInfo={gameInfo}
              onAnalyze={analyzePGN}
              onStopAnalysis={stopAnalysis}
              onMoveClick={goToMove}
              onFirst={goFirst}
              onPrevious={goPrevious}
              onNext={goNext}
              onLast={goLast}
              className="h-full"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>Use arrow keys ← → to navigate • Space to play/pause • Home/End for first/last move</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
