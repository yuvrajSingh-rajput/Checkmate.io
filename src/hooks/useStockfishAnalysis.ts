import { useState, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import type { AnalyzedMove, MoveClassification, GameInfo, AnalysisState } from '@/types/chess';
import { useChessSounds } from './useChessSounds';
// Mock classification based on move index for demo purposes
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

// Mock evaluation that fluctuates realistically
function getMockEvaluation(moveIndex: number): number {
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

function evalToWinChance(evaluation: number): number {
  const k = 0.004;
  return 50 + 50 * (2 / (1 + Math.exp(-k * evaluation * 100)) - 1);
}

function parsePGNHeaders(pgn: string): GameInfo {
  const info: GameInfo = {
    white: 'White',
    black: 'Black',
  };
  
  const headerRegex = /\[(\w+)\s+"([^"]+)"\]/g;
  let match;
  
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
      case 'best': return 100;
      case 'good': return 90;
      case 'book': return 100;
      case 'forced': return 100;
      case 'inaccuracy': return 70;
      case 'mistake': return 40;
      case 'blunder': return 0;
      default: return 80;
    }
  });
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
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
  const { playSoundForMove } = useChessSounds();

  const analyzePGN = useCallback(async (pgn: string) => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    
    const gameInfo = parsePGNHeaders(pgn);
    const chess = new Chess();
    
    try {
      chess.loadPgn(pgn);
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
    
    setState({
      moves: [],
      currentMoveIndex: -1,
      isAnalyzing: true,
      progress: 0,
      whiteAccuracy: 0,
      blackAccuracy: 0,
      gameInfo,
    });

    const analyzedMoves: AnalyzedMove[] = [];
    const analysisChess = new Chess();
    
    for (let i = 0; i < history.length; i++) {
      const move = history[i];
      analysisChess.move(move.san);
      
      // Simulate analysis delay (50ms per move for demo)
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const classification = getMockClassification(i);
      const evaluation = getMockEvaluation(i);
      
      const analyzedMove: AnalyzedMove = {
        moveNumber: Math.floor(i / 2) + 1,
        san: move.san,
        from: move.from,
        to: move.to,
        color: move.color,
        fen: analysisChess.fen(),
        evaluation: evaluation,
        classification,
        winChance: evalToWinChance(evaluation),
      };
      
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
      isAnalyzing: false,
      whiteAccuracy: calcAccuracy(whiteMoves),
      blackAccuracy: calcAccuracy(blackMoves),
      currentMoveIndex: analyzedMoves.length - 1,
    }));
    
    isAnalyzingRef.current = false;
  }, []);

  const stopAnalysis = useCallback(() => {
    isAnalyzingRef.current = false;
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
