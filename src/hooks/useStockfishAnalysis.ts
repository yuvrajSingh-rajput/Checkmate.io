import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess } from 'chess.js';
import type { AnalyzedMove, MoveClassification, GameInfo, AnalysisState, EngineLine } from '@/types/chess';
import { useChessSounds } from './useChessSounds';
import { useStockfishEngine, type AnalysisNode } from './useStockfishEngine';
import analyse from '@/lib/chess/analysis';
import { Classification } from '@/lib/chess/classification';
import openings from '@/resources/openings.json';

// Helper function to convert classification to our MoveClassification type
function convertClassification(classification: Classification): MoveClassification {
  switch (classification) {
    case Classification.BRILLIANT: return 'brilliant';
    case Classification.GREAT: return 'great';
    case Classification.BEST: return 'best';
    case Classification.EXCELLENT: return 'excellent';
    case Classification.GOOD: return 'good';
    case Classification.INACCURACY: return 'inaccuracy';
    case Classification.MISTAKE: return 'mistake';
    case Classification.BLUNDER: return 'blunder';
    case Classification.BOOK: return 'book';
    case Classification.FORCED: return 'forced';
    default: return 'book';
  }
}

// DEPRECATED: Do not use this function - engine already provides winProb
// This function should not be called to avoid double logistic application
// Kept for backward compatibility with fallback analysis only
function calculateWinChanceFromCentipawns(cp: number): number {
  // cp may be in positive/negative; the formula is symmetric
  const prob = 1 / (1 + Math.pow(10, -cp / 400));
  return Math.round(prob * 10000) / 100; // return with two decimals (e.g. 53.12)
}

function parsePGNHeaders(pgn: string): GameInfo {
  const info: GameInfo = {
    white: 'White',
    black: 'Black',
  };

  const headerRegex = /\[(\w+)\s+"([^"]+)"\]/g;
  let match: RegExpExecArray | null;

  while ((match = headerRegex.exec(pgn)) !== null) {
    const [, key, value] = match;
    switch (key.toLowerCase()) {
      case 'white':
        info.white = value;
        break;
      case 'black':
        info.black = value;
        break;
      case 'whiteelo':
        info.whiteElo = parseInt(value) || undefined;
        break;
      case 'blackelo':
        info.blackElo = parseInt(value) || undefined;
        break;
      case 'result':
        info.result = value;
        break;
      case 'event':
        info.event = value;
        break;
      case 'date':
        info.date = value;
        break;
    }
  }

  return info;
}

function calcAccuracy(moves: AnalyzedMove[]): number {
  if (moves.length === 0) return 100;
  const scores = moves.map(m => {
    switch (m.classification) {
      case 'brilliant': return 100;
      case 'great': return 100;
      case 'best': return 100;
      case 'excellent': return 96;
      case 'good': return 85;
      case 'book': return 100;
      case 'forced': return 100;
      case 'inaccuracy': return 70;
      case 'miss': return 50; // Missed tactical opportunities (if used)
      case 'mistake': return 40;
      case 'blunder': return 10;
      default: return 80;
    }
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// Fallback mock analysis when Stockfish fails to load
function getMockClassification(moveIndex: number): MoveClassification {
  const classifications: MoveClassification[] = [
    'book', 'book', 'book', 'book',
    'best', 'good', 'best', 'good',
    'inaccuracy', 'best', 'good', 'best',
    'mistake', 'brilliant', 'good', 'best',
    'good', 'blunder', 'best', 'best',
    'good', 'good', 'inaccuracy', 'best',
    'good', 'best', 'good', 'good',
    'best', 'best', 'good', 'best',
    'good', 'good', 'best', 'good',
    'best', 'good', 'best', 'best',
    'good', 'best', 'good', 'best',
  ];
  return classifications[moveIndex % classifications.length];
}

function getMockEvaluation(moveIndex: number): number {
  // Returns evaluation in pawns (e.g. 0.2 == +20 centipawns)
  const baseEvals = [
    0.0, 0.1, 0.2, 0.15, 0.3, 0.25, 0.4, 0.35,
    0.2, 0.5, 0.45, 0.6, 0.3, 0.8, 0.75, 0.9,
    0.85, 0.4, 1.2, 1.1, 1.0, 1.15, 0.9, 1.3,
    1.25, 1.4, 1.35, 1.5, 1.6, 1.7, 1.65, 1.8,
    1.75, 1.9, 2.0, 1.95, 2.1, 2.2, 2.5, 2.8,
    3.0, 3.5, 4.0, 5.0,
  ];
  return baseEvals[moveIndex % baseEvals.length];
}

async function fallbackAnalysis(history: any[], gameInfo: GameInfo, setState: React.Dispatch<React.SetStateAction<AnalysisState>>) {
  const analyzedMoves: AnalyzedMove[] = [];
  const analysisChess = new Chess();

  for (let i = 0; i < history.length; i++) {
    const move = history[i];
    analysisChess.move(move.san);

    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 20));

    const classification = getMockClassification(i);
    const evaluationPawns = getMockEvaluation(i); // in pawns
    const evaluationCentipawns = Math.round(evaluationPawns * 100);

    const analyzedMove: AnalyzedMove = {
      moveNumber: Math.floor(i / 2) + 1,
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      fen: analysisChess.fen(),
      evaluation: evaluationPawns, // pawns
      classification,
      bestMove: '',
      winChance: calculateWinChanceFromCentipawns(evaluationCentipawns), // percent 0-100
    } as AnalyzedMove;

    analyzedMoves.push(analyzedMove);

    setState(prev => ({
      ...prev,
      progress: Math.round(((i + 1) / history.length) * 100),
      moves: [...analyzedMoves],
    }));
  }

  const whiteMoves = analyzedMoves.filter(m => m.color === 'w');
  const blackMoves = analyzedMoves.filter(m => m.color === 'b');

  setState(prev => ({
    ...prev,
    moves: analyzedMoves,
    isAnalyzing: false,
    whiteAccuracy: calcAccuracy(whiteMoves),
    blackAccuracy: calcAccuracy(blackMoves),
    currentMoveIndex: analyzedMoves.length - 1,
    progress: 100,
  }));
}

export function useStockfishAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    moves: [],
    currentMoveIndex: -1,
    isAnalyzing: false,
    progress: 0,
    whiteAccuracy: 0,
    blackAccuracy: 0,
    gameInfo: { white: 'White', black: 'Black' },
  });

  const isAnalyzingRef = useRef(false);
  const analysisDataRef = useRef<{ history: any[]; fens: string[] } | null>(null);
  const isProcessingRef = useRef(false); // Guard against duplicate processing

  const { playSoundForMove } = useChessSounds();
  const { isReady, isAnalyzing: engineAnalyzing, analysis, progress: engineProgress, analyzeGame } = useStockfishEngine();

  // Monitor analysis progress and completion
  useEffect(() => {
    (async () => {
      if (!state.isAnalyzing || !analysisDataRef.current) return;
      if (isProcessingRef.current) {
        console.log('[StockfishAnalysis] Already processing results, skipping...');
        return;
      }

      const { history, fens } = analysisDataRef.current;

      // Update progress from engine progress - reaches 100% only after all FENs analyzed
      if (engineProgress && typeof engineProgress.total === 'number' && engineProgress.total > 0) {
        const percentage = Math.round((engineProgress.current / engineProgress.total) * 100);
        if (percentage > state.progress) {
          setState(prev => ({ ...prev, progress: percentage }));
        }
      }

      // Determine analysis size safely (Map.size or object length)
      const analysisSize = (analysis && typeof (analysis as any).size === 'number')
        ? (analysis as any).size
        : (analysis ? Object.keys(analysis as any).length : 0);

      const isEngineDone = !engineAnalyzing;
      
      // Log current state for debugging
      console.log('[StockfishAnalysis] Check:', {
        isAnalyzing: state.isAnalyzing,
        isEngineDone,
        analysisSize,
        fensLength: fens.length,
        engineProgress: engineProgress
      });
      
      // Process results when engine is done and we have sufficient data
      // Allow processing with 90%+ data to handle edge cases (timeouts, etc.)
      const hasSufficientData = analysisSize >= Math.floor(fens.length * 0.9);
      const hasAllData = analysisSize >= fens.length;

      if (isEngineDone && (hasAllData || hasSufficientData)) {
        // Set processing flag to prevent duplicate runs
        if (isProcessingRef.current) {
          console.log('[StockfishAnalysis] Already processing, skipping duplicate...');
          return;
        }
        isProcessingRef.current = true;
        
        console.log('[StockfishAnalysis] Analysis complete. Processing results...', {
          analysisSize,
          fensLength: fens.length,
          hasAllData,
          hasSufficientData
        });

        const evaluatedPositions: any[] = [];
        const sanChess = new Chess();

        for (let i = 0; i < fens.length; i++) {
          const fen = fens[i];
          const analysisNode: any = (analysis && typeof (analysis as any).get === 'function') ? (analysis as any).get(fen) : (analysis ? (analysis as any)[fen] : null);

          const move = i > 0 ? history[i - 1] : null;

          const evaluatedPosition: any = {
            fen,
            move: {
              uci: move ? (move.uci || `${move.from}${move.to}`) : '',
              san: move ? move.san : '',
            },
            topLines: [],
            classification: undefined,
            opening: undefined,
            worker: 'stockfish',
          };

          if (analysisNode && Array.isArray(analysisNode.multiPv) && analysisNode.multiPv.length > 0) {
            for (let pvIndex = 0; pvIndex < analysisNode.multiPv.length; pvIndex++) {
              const pvLine = analysisNode.multiPv[pvIndex];

              let moveSan = '';
              try {
                sanChess.load(fen);
                const sanMove = sanChess.move({
                  from: pvLine.move.slice(0, 2),
                  to: pvLine.move.slice(2, 4),
                  promotion: pvLine.move.slice(4) || undefined,
                });
                moveSan = sanMove?.san || '';
              } catch (e) {
                // ignore
              }

              evaluatedPosition.topLines.push({
                id: pvIndex + 1,
                depth: pvLine.depth,
                evaluation: {
                  type: pvLine.mateIn !== undefined ? 'mate' : 'cp',
                  value: pvLine.score,
                  mateIn: pvLine.mateIn,
                },
                moveUCI: pvLine.move,
                moveSAN: moveSan,
              });
            }
          } else if (analysisNode && analysisNode.bestMove) {
            let bestMoveSan = '';
            try {
              sanChess.load(fen);
              const sanMove = sanChess.move({
                from: analysisNode.bestMove.slice(0, 2),
                to: analysisNode.bestMove.slice(2, 4),
                promotion: analysisNode.bestMove.slice(4) || undefined,
              });
              bestMoveSan = sanMove?.san || '';
            } catch (e) {
              // ignore
            }

            evaluatedPosition.topLines.push({
              id: 1,
              depth: analysisNode.depth || 20,
              evaluation: {
                type: analysisNode.mateIn !== undefined ? 'mate' : 'cp',
                value: analysisNode.score,
                mateIn: analysisNode.mateIn,
              },
              moveUCI: analysisNode.bestMove || '',
              moveSAN: bestMoveSan,
            });
          } else {
            console.warn('[Analysis] No analysis data for FEN:', fen);
            evaluatedPosition.topLines.push({
              id: 1,
              depth: 0,
              evaluation: { type: 'cp', value: 0 },
              moveUCI: '',
              moveSAN: '',
            });
          }

          evaluatedPositions.push(evaluatedPosition);
        }

        // Run sophisticated analysis
        const report = await analyse(evaluatedPositions);

        const analyzedMoves: AnalyzedMove[] = [];

        for (let i = 0; i < history.length; i++) {
          const move = history[i];
          const evaluatedPosition = evaluatedPositions[i + 1]; // position after the move
          const fenAfterMove = fens[i + 1];
          
          // Get position before the move for best move and evaluation display
          const positionBeforeMove = evaluatedPositions[i];
          
          // Get analysis node for position AFTER move to get WHITE-RELATIVE winProb
          // This is the evaluation of the position after the move was played
          const analysisNode: any = (analysis && typeof (analysis as any).get === 'function') 
            ? (analysis as any).get(fenAfterMove) 
            : (analysis ? (analysis as any)[fenAfterMove] : null);
          
          // Use WHITE-RELATIVE winProb from engine (already calculated correctly, never recompute)
          // This is the white winning probability after the move
          const whiteWinProb = analysisNode?.winProb ?? 50;
          
          // Evaluation for display: use position AFTER move (current position)
          // This is WHITE-RELATIVE: positive = white winning, negative = black winning
          const evaluationAfterMove = evaluatedPosition?.topLines?.[0]?.evaluation;
          let engineEvalWhite = 0;
          let mateInWhite: number | undefined = undefined;
          if (evaluationAfterMove) {
            if (evaluationAfterMove.type === 'mate') {
              // For mate, use placeholder CP for display (mate shows as ±3000cp equivalent)
              engineEvalWhite = evaluationAfterMove.mateIn && evaluationAfterMove.mateIn > 0 ? 3000 : -3000;
              mateInWhite = evaluationAfterMove.mateIn;
            } else {
              engineEvalWhite = evaluationAfterMove.value || 0;
            }
          }
          
          // Convert classification (from analysis.ts, already correct)
          const classification = convertClassification(evaluatedPosition.classification || Classification.BOOK);

          // Find opening name - only show until first non-book classification
          // Check if any previous move was non-book
          let opening: string | undefined = undefined;
          const hasNonBookMove = analyzedMoves.some(m => 
            m.classification !== 'book' && m.classification !== 'forced'
          );
          if (!hasNonBookMove && (classification === 'book' || classification === 'forced')) {
            opening = openings.find((o: any) => fenAfterMove.includes(o.fen))?.name;
          }

          // Build engine lines (PV1..PV3) - preserve multipv order
          const engineLines: EngineLine[] = (evaluatedPositions[i + 1]?.topLines || [])
            .slice(0, 3) // Only show top 3 PV lines
            .map((line: any) => ({
              id: line.id,
              depth: line.depth,
              evaluation: {
                type: line.evaluation.type,
                value: line.evaluation.value,
                mateIn: line.evaluation.mateIn, // Preserve mate distance
              },
              moveUCI: line.moveUCI,
              moveSAN: line.moveSAN,
            }));

          // Best move is PV1 from position BEFORE the move
          const bestMove = positionBeforeMove?.topLines?.[0]?.moveUCI || '';

          analyzedMoves.push({
            moveNumber: Math.floor(i / 2) + 1,
            san: move.san,
            from: move.from,
            to: move.to,
            color: move.color,
            fen: fenAfterMove,
            evaluation: engineEvalWhite / 100, // convert centipawns -> pawns (WHITE-RELATIVE)
            mateIn: mateInWhite,
            classification,
            bestMove, // PV1 from previous position
            winChance: whiteWinProb, // Engine-provided WHITE-RELATIVE win probability (0-100), never recomputed
            opening, // Only shown until first non-book move
            engineLines, // PV1..PV3 from current position
          });
        }

        // Use accuracy from report (calculated using Chess.com EPL model)
        // Never use fallback calcAccuracy - report.accuracies is authoritative
        setState(prev => ({
          ...prev,
          moves: analyzedMoves,
          isAnalyzing: false,
          whiteAccuracy: report.accuracies?.white ?? 100,
          blackAccuracy: report.accuracies?.black ?? 100,
          currentMoveIndex: analyzedMoves.length - 1,
          progress: 100, // 100% only after all FENs analyzed
        }));

        console.log('[StockfishAnalysis] Results processed successfully:', {
          movesCount: analyzedMoves.length,
          whiteAccuracy: report.accuracies?.white,
          blackAccuracy: report.accuracies?.black
        });

        isAnalyzingRef.current = false;
        analysisDataRef.current = null;
        isProcessingRef.current = false; // Reset processing flag
      } else if (isEngineDone && !hasSufficientData) {
        // Engine done but insufficient data - log warning and stop analyzing
        console.warn('[StockfishAnalysis] Engine done but insufficient data:', {
          analysisSize,
          fensLength: fens.length,
          required: Math.floor(fens.length * 0.9)
        });
        setState(prev => ({ ...prev, isAnalyzing: false }));
        isAnalyzingRef.current = false;
        analysisDataRef.current = null;
        isProcessingRef.current = false; // Reset processing flag
      }
    })();
  }, [engineAnalyzing, analysis, state.isAnalyzing, engineProgress, state.progress]);

  const analyzePGN = useCallback(async (pgn: string) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    isProcessingRef.current = false; // Reset processing flag for new analysis

    const gameInfo = parsePGNHeaders(pgn);
    const chess = new Chess();

    try {
      // loadPgn returns true/false in some chess.js versions; wrap in try/catch
      // Use loadPgn if available
      // @ts-ignore
      if (typeof chess.loadPgn === 'function') {
        // Some versions return boolean, some throw. We try and validate.
        // @ts-ignore
        chess.loadPgn(pgn);
      } else {
        throw new Error('chess.js: loadPgn not available');
      }
    } catch (e) {
      console.error('Invalid PGN:', e);
      isAnalyzingRef.current = false;
      return;
    }

    const history = chess.history({ verbose: true });
    if (history.length === 0) {
      isAnalyzingRef.current = false;
      return;
    }

    // Build FENs: start pos + after each move
    const fens: string[] = [];
    const tempChess = new Chess();
    fens.push(tempChess.fen());

    for (let i = 0; i < history.length; i++) {
      tempChess.move(history[i].san);
      fens.push(tempChess.fen());
    }

    analysisDataRef.current = { history, fens };

    setState({
      moves: [],
      currentMoveIndex: -1,
      isAnalyzing: true,
      progress: 0,
      whiteAccuracy: 0,
      blackAccuracy: 0,
      gameInfo,
    });

    try {
      if (!isReady) {
        console.warn('Stockfish engine not ready, using fallback analysis');
        await fallbackAnalysis(history, gameInfo, setState);
        isAnalyzingRef.current = false;
        analysisDataRef.current = null;
        return;
      }

      // Start engine analysis — analyzeGame should accept fens (start + positions)
      analyzeGame(fens);

    } catch (error) {
      console.error('Analysis failed:', error);
      setState(prev => ({ ...prev, isAnalyzing: false }));
      isAnalyzingRef.current = false;
      analysisDataRef.current = null;
    }
  }, [isReady, analyzeGame]);

  const stopAnalysis = useCallback(() => {
    isAnalyzingRef.current = false;
    isProcessingRef.current = false; // Reset processing flag
    setState(prev => ({ ...prev, isAnalyzing: false }));
  }, []);

  const goToMove = useCallback((index: number) => {
    setState(prev => {
      const newIndex = Math.max(-1, Math.min(index, prev.moves.length - 1));
      if (newIndex >= 0 && newIndex !== prev.currentMoveIndex) {
        playSoundForMove(prev.moves[newIndex].san);
      }
      return { ...prev, currentMoveIndex: newIndex };
    });
  }, [playSoundForMove]);

  const goFirst = useCallback(() => {
    setState(prev => ({ ...prev, currentMoveIndex: -1 }));
  }, []);

  const goPrevious = useCallback(() => {
    setState(prev => {
      const newIndex = Math.max(-1, prev.currentMoveIndex - 1);
      if (newIndex >= 0) {
        playSoundForMove(prev.moves[newIndex].san);
      }
      return { ...prev, currentMoveIndex: newIndex };
    });
  }, [playSoundForMove]);

  const goNext = useCallback(() => {
    setState(prev => {
      const newIndex = Math.min(prev.moves.length - 1, prev.currentMoveIndex + 1);
      if (newIndex >= 0 && newIndex !== prev.currentMoveIndex) {
        playSoundForMove(prev.moves[newIndex].san);
      }
      return { ...prev, currentMoveIndex: newIndex };
    });
  }, [playSoundForMove]);

  const goLast = useCallback(() => {
    setState(prev => {
      const lastIndex = prev.moves.length - 1;
      if (lastIndex >= 0 && lastIndex !== prev.currentMoveIndex) {
        playSoundForMove(prev.moves[lastIndex].san);
      }
      return { ...prev, currentMoveIndex: lastIndex };
    });
  }, [playSoundForMove]);

  return {
    ...state,
    analyzePGN,
    stopAnalysis,
    goToMove,
    goFirst,
    goPrevious,
    goNext,
    goLast,
  };
}
