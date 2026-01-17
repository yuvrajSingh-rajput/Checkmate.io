import { useCallback, useEffect, useRef, useState } from 'react';

// Analysis settings - Optimized for fast analysis like Chess.com
const ANALYSIS_TIME_MS = 1000; // 1 second per position (balanced speed/quality)

export interface AnalysisNode {
  fen: string;
  score: number;        // Centipawns (White relative)
  winProb: number;      // 0-1 (White winning probability)
  bestMove: string;     // UCI
  pv: string[];
  depth: number;
  classification?: string;
  moveNumber: number;
}

export interface AnalysisProgress {
  current: number;
  total: number;
}

interface Job {
  fen: string;
  moveNumber: number;
  moveColor: 'w' | 'b';
  prevFen: string | null;
}

export const useStockfishEngine = () => {
  const engineRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({ current: 0, total: 0 });
  const [analysis, setAnalysis] = useState<Map<string, AnalysisNode>>(new Map());

  // Mutable state for analysis loop
  const queueRef = useRef<Job[]>([]);
  const currentJobRef = useRef<Job | null>(null);
  const analysisMapRef = useRef<Map<string, AnalysisNode>>(new Map());

  useEffect(() => {
    console.log('[Stockfish] Loading engine...');
    
    // Load loadEngine script
    const script = document.createElement('script');
    script.src = '/loadEngine.js';
    script.onload = () => {
      console.log('[Stockfish] loadEngine.js loaded');
      
      // Initialize engine
      const loadEngine = (window as any).loadEngine;
      if (!loadEngine) {
        console.error('[Stockfish] loadEngine not found on window');
        return;
      }
      
      console.log('[Stockfish] Initializing engine with path: /engine/stockfish-17.1-lite-single-03e3232.js');
      const engine = loadEngine('/engine/stockfish-17.1-lite-single-03e3232.js');
      engineRef.current = engine;

      // Initialize UCI
      engine.send('uci', () => {
        console.log('[Stockfish] UCI initialized');
        engine.send('isready', () => {
          console.log('[Stockfish] Engine ready!');
          setIsReady(true);
        });
      });
    };
    
    script.onerror = (error) => {
      console.error('[Stockfish] Failed to load loadEngine.js', error);
    };
    
    document.head.appendChild(script);

    return () => {
      if (engineRef.current) {
        engineRef.current.quit();
      }
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const updateNode = useCallback((fen: string, data: Partial<AnalysisNode>) => {
    const existing = analysisMapRef.current.get(fen) || {
      fen,
      score: 0,
      winProb: 0.5,
      bestMove: '',
      pv: [],
      depth: 0,
      moveNumber: 0
    };
    const next = { ...existing, ...data };
    analysisMapRef.current.set(fen, next);
    console.log('[Engine] Analysis updated for FEN:', fen, next);
    setAnalysis(new Map(analysisMapRef.current));
  }, []);

  const processNextJob = useCallback(() => {
    if (queueRef.current.length === 0) {
      console.log('[Analysis] Queue complete!');
      setIsAnalyzing(false);
      currentJobRef.current = null;
      return;
    }

    const job = queueRef.current.shift();
    if (!job) return;

    currentJobRef.current = job;
    setProgress(prev => ({ ...prev, current: prev.current + 1 }));
    
    console.log(`[Analysis] Processing position ${progress.current + 1}/${progress.total}:`, job.fen);

    const engine = engineRef.current;
    if (!engine) return;

    // Send position command
    engine.send(`position fen ${job.fen}`);
    
    // Track depth and PV during analysis
    let bestDepth = 0;
    let bestPv: string[] = [];
    let analysisComplete = false;
    
    // Stream handler for info lines
    const streamHandler = (line: string) => {
      console.log('[Engine] Stream:', line);
      
      if (line.startsWith('info') && line.includes('score') && !line.includes('lowerbound') && !line.includes('upperbound')) {
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const depthMatch = line.match(/depth (\d+)/);
        const pvMatch = line.match(/ pv (.+)/);

        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        
        let rawScore = 0;
        if (scoreMatch) {
          rawScore = parseInt(scoreMatch[1], 10);
        } else if (mateMatch) {
          const mateIn = parseInt(mateMatch[1], 10);
          rawScore = mateIn > 0 ? 3000 : -3000;
        }

        // Convert to White-relative score
        const turn = job.fen.split(' ')[1];
        const whiteScore = turn === 'w' ? rawScore : -rawScore;
        
        if (depth >= bestDepth) {
          bestDepth = depth;
          bestPv = pvMatch ? pvMatch[1].split(' ') : [];
          
          updateNode(job.fen, {
            score: whiteScore,
            winProb: cpToWinProbability(whiteScore),
            depth,
            pv: bestPv,
            bestMove: bestPv[0] || '',
            moveNumber: job.moveNumber
          });
        }
      }
    };

    // Send go command with stream handler
    engine.send(`go movetime ${ANALYSIS_TIME_MS}`, (bestmoveLine: string) => {
      console.log('[Analysis] Bestmove:', bestmoveLine);
      analysisComplete = true;
      
      const bestMove = bestmoveLine.split(' ')[1];
      updateNode(job.fen, {
        bestMove: bestMove === '(none)' ? undefined : bestMove
      });

      // Process next job
      setTimeout(() => processNextJob(), 100); // Small delay between positions
    }, streamHandler);
  }, [updateNode, progress]);

  const analyzeGame = useCallback((fens: string[]) => {
    if (!engineRef.current || !isReady) {
      console.warn('[Analysis] Engine not ready');
      return;
    }

    console.log('[Analysis] Starting analysis of', fens.length, 'positions');

    // Reset state
    analysisMapRef.current.clear();
    setAnalysis(new Map());
    setIsAnalyzing(true); // CRITICAL: This must be called
    setProgress({ current: 0, total: fens.length });

    // Build job queue
    const jobs: Job[] = fens.map((fen, index) => {
      const moveColor = (index % 2 !== 0) ? 'w' : 'b';
      return {
        fen,
        moveNumber: index,
        moveColor,
        prevFen: index > 0 ? fens[index - 1] : null
      };
    });

    queueRef.current = jobs;
    currentJobRef.current = null;

    // Start processing
    console.log('[Analysis] Starting job processing...');
    processNextJob();
  }, [isReady, processNextJob]);

  return { isReady, isAnalyzing, analysis, progress, analyzeGame };
};

// Helper function to convert centipawns to win probability
function cpToWinProbability(cp: number): number {
  return 1 / (1 + Math.exp(-cp / 100));
}
