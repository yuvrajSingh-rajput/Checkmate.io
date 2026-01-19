import { useCallback, useEffect, useRef, useState } from 'react';

// Analysis settings - Optimized for fast analysis like Chess.com
const ANALYSIS_TIME_MS = 1000; // 1 second per position (balanced speed/quality)

export interface PVLine {
  move: string;      // UCI format
  score: number;     // Centipawns (White relative)
  mateIn?: number;   // Mate distance (positive = White mates, negative = Black mates)
  pv: string[];      // Principal variation
  depth: number;
}

export interface AnalysisNode {
  fen: string;
  score: number;        // Centipawns (White relative) - best line
  mateIn?: number;       // Mate distance for best line
  winProb: number;      // 0-100 (White winning probability percentage)
  bestMove: string;     // UCI - best move
  pv: string[];         // Principal variation - best line
  depth: number;
  multiPv?: PVLine[];   // All PV lines (top 3 moves) - optional for backward compatibility
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
        
        // Enable Multi-PV mode (analyze top 3 moves)
        engine.send('setoption name MultiPV value 3', () => {
          console.log('[Stockfish] Multi-PV enabled');
          
          engine.send('isready', () => {
            console.log('[Stockfish] Engine ready!');
            setIsReady(true);
          });
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
      winProb: 50, // 50% default
      bestMove: '',
      pv: [],
      depth: 0,
      multiPv: [],
      moveNumber: 0
    };
    const next = { ...existing, ...data };
    analysisMapRef.current.set(fen, next);
    console.log('[Engine] Analysis updated for FEN:', fen, {
      score: next.score,
      depth: next.depth,
      multiPvCount: next.multiPv?.length || 0,
      hasBestMove: !!next.bestMove
    });
    // Create new Map instance to trigger React state update
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
    setProgress(prev => {
      const newCurrent = prev.current + 1;
      console.log(`[Analysis] Processing position ${newCurrent}/${prev.total}:`, job.fen);
      return { ...prev, current: newCurrent };
    });

    const engine = engineRef.current;
    if (!engine) return;

    // Send position command
    engine.send(`position fen ${job.fen}`);
    
    // Track depth and PV during analysis - depth-synchronized MultiPV snapshots
    let currentDepth = 0;
    let bestPv: string[] = [];
    const multiPvLines: Map<number, PVLine> = new Map();
    const depthSnapshots: Map<number, Map<number, PVLine>> = new Map(); // depth -> multipv -> PVLine
    let hasReceivedData = false; // Track if we've received any analysis data
    let isComplete = false; // Guard to prevent duplicate processing
    
    // Timeout protection - ensure we don't get stuck on a position
    const timeoutId = setTimeout(() => {
      if (isComplete) return; // Already processed
      console.warn(`[Analysis] Timeout for position ${job.fen}, proceeding to next`);
      isComplete = true;
      // Ensure we have at least some data before proceeding
      if (!hasReceivedData) {
        // Create a default node with zero evaluation
        updateNode(job.fen, {
          moveNumber: job.moveNumber,
          depth: 0,
          score: 0,
          winProb: 50,
          bestMove: '',
          pv: [],
          multiPv: []
        });
      }
      // Process next job even if timeout
      setTimeout(() => processNextJob(), 100);
    }, ANALYSIS_TIME_MS + 2000); // Add 2 second buffer
    
    // Stream handler for info lines
    const streamHandler = (line: string) => {
      // Only log lines with score info to reduce noise
      if (line.includes('score')) {
        console.log('[Engine] Stream:', line);
      }
      
      if (line.startsWith('info') && line.includes('score') && !line.includes('lowerbound') && !line.includes('upperbound')) {
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        const depthMatch = line.match(/depth (\d+)/);
        const pvMatch = line.match(/ pv (.+)/);
        const multiPvMatch = line.match(/multipv (\d+)/);

        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 0;
        const multiPvIndex = multiPvMatch ? parseInt(multiPvMatch[1], 10) : 1;
        
        // Only process if depth increased (depth-synchronized snapshot)
        if (depth < currentDepth) {
          return; // Ignore stale depth updates
        }
        
        // New depth reached - snapshot all MultiPV lines at this depth
        if (depth > currentDepth) {
          currentDepth = depth;
          // Clear previous depth snapshot
          depthSnapshots.set(depth, new Map());
        }
        
        let rawScore = 0;
        let mateInStm: number | undefined; // UCI "mate" is from side-to-move perspective
        if (scoreMatch) {
          rawScore = parseInt(scoreMatch[1], 10);
        } else if (mateMatch) {
          mateInStm = parseInt(mateMatch[1], 10);
          // Store mateIn separately, use placeholder CP for display
          // Do NOT map to ±3000 - keep actual mate distance
          rawScore = mateInStm > 0 ? 3000 : -3000; // Placeholder only for sorting
        }

        /**
         * CRITICAL: Stockfish UCI "score cp" / "score mate" is SIDE-TO-MOVE relative.
         * That means it naturally flips sign every ply for stable positions.
         *
         * We convert it once here into strict WHITE-RELATIVE:
         * - +cp => better for White, -cp => better for Black
         * - mateIn > 0 => White mates, mateIn < 0 => Black mates
         */
        const sideToMove = job.fen.includes(' w ') ? 'w' : 'b';
        const stmMultiplier = sideToMove === 'w' ? 1 : -1;
        const whiteScore = rawScore * stmMultiplier;
        const mateIn = mateInStm !== undefined ? mateInStm * stmMultiplier : undefined;
        const pv = pvMatch ? pvMatch[1].split(' ').filter(m => m.length > 0) : [];
        
        if (pv.length > 0) {
          hasReceivedData = true; // Mark that we've received analysis data
          
          // Store PV line at current depth snapshot
          const depthSnapshot = depthSnapshots.get(depth) || new Map();
          depthSnapshot.set(multiPvIndex, {
            move: pv[0] || '',
            score: whiteScore,
            mateIn, // Store actual mate distance, not converted CP
            pv,
            depth
          });
          depthSnapshots.set(depth, depthSnapshot);
          
          // Also update current multiPvLines for immediate access
          multiPvLines.set(multiPvIndex, {
            move: pv[0] || '',
            score: whiteScore,
            mateIn,
            pv,
            depth
          });
          
          if (multiPvIndex > 1) {
             console.log(`[Stockfish] MultiPV ${multiPvIndex} depth ${depth}: move=${pv[0]}, score=${whiteScore}, mateIn=${mateIn}`);
          }
        }
        
        // Track best PV (PV1) for main evaluation
        if (multiPvIndex === 1 && pv.length > 0) {
          bestPv = pv;
        }
        
        // Snapshot only when depth increases - update with all MultiPV lines at this depth
        if (depth === currentDepth) {
          const snapshot = depthSnapshots.get(depth);
          if (snapshot && snapshot.size > 0) {
            // Build multiPv array preserving multipv index order (1, 2, 3...)
            const sortedMultiPv = Array.from(snapshot.entries())
              .sort((a, b) => a[0] - b[0]) // Sort by multipv index
              .map(entry => entry[1]); // Extract PVLine values
            
            // Get PV1 data for main evaluation
            const pv1 = snapshot.get(1);
            
            const updateData: Partial<AnalysisNode> = {
              moveNumber: job.moveNumber,
              depth: currentDepth,
              multiPv: sortedMultiPv
            };

            // Update main score/bestMove from PV1
            if (pv1) {
              updateData.score = pv1.score;
              updateData.mateIn = pv1.mateIn; // Store actual mate distance
              updateData.winProb = cpToWinProbability(pv1.score, pv1.mateIn);
              updateData.bestMove = pv1.move || '';
              updateData.pv = pv1.pv;
            }

            updateNode(job.fen, updateData);
          }
        }
      }
    };

    // Send go command with stream handler
    engine.send(`go movetime ${ANALYSIS_TIME_MS}`, (bestmoveLine: string) => {
      // Guard against duplicate processing
      if (isComplete) {
        console.warn('[Analysis] Duplicate callback detected, ignoring');
        return;
      }
      isComplete = true;
      
      // Clear timeout since we got a response
      clearTimeout(timeoutId);
      
      console.log('[Analysis] Bestmove:', bestmoveLine);
      console.log('[Analysis] Multi-PV lines captured:', multiPvLines.size);
      console.log('[Analysis] Multi-PV data:', Array.from(multiPvLines.values()));
      
      // Ensure we have at least some data
      if (!hasReceivedData) {
        console.warn('[Analysis] No analysis data received, creating default node');
        updateNode(job.fen, {
          moveNumber: job.moveNumber,
          depth: 0,
          score: 0,
          winProb: 50,
          bestMove: '',
          pv: [],
          multiPv: []
        });
      }
      
      // Don't call updateNode here - it would overwrite the multiPv data
      // The multiPv data was already set in the stream handler
      // Just update the bestMove if needed
      const bestMove = bestmoveLine.split(' ')[1];
      if (bestMove && bestMove !== '(none)') {
        const existing = analysisMapRef.current.get(job.fen);
        if (existing && existing.bestMove !== bestMove) {
          updateNode(job.fen, {
            bestMove: bestMove
          });
        }
      }

      // Process next job
      setTimeout(() => processNextJob(), 100); // Small delay between positions
    }, streamHandler);
  }, [updateNode]);

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

// Helper function to convert centipawns to win probability (0-100)
// Uses the standard logistic curve: WinChance = 1 / (1 + 10^(-cp/400))
// NEVER apply logistic twice - this is the single source of truth
// Mate handling: mateIn > 0 → 99.9%, mateIn < 0 → 0.1% (Chess.com style)
// All evaluations are WHITE-RELATIVE
function cpToWinProbability(cp: number, mateIn?: number): number {
  if (mateIn !== undefined) {
    // Chess.com style mate probability - saturate at 99.9%/0.1%
    // mateIn is white-relative: positive = white mates, negative = black mates
    return mateIn > 0 ? 99.9 : 0.1;
  }
  // Single logistic application: P = 1 / (1 + 10^(-cp / 400))
  // cp is white-relative: positive = white winning, negative = black winning
  const winChance = 1 / (1 + Math.pow(10, -cp / 400));
  return winChance * 100; // Return as percentage 0-100 (white winning probability)
}
