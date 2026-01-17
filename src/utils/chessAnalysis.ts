// Chess.com-accurate Expected Points Model and Move Classification

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss';

export interface BrilliantContext {
  isSacrifice: boolean;
  depthGain: number;
  uniqueness: number;
  pvDivergence?: number;
  moveNumber?: number;
}

// Chess.com logistic curve (reverse-engineered)
// Converts centipawns to win probability (0-1)
export function cpToWinProbability(cp: number): number {
  // Handle mate scores
  if (cp >= 3000) return 1.0;
  if (cp <= -3000) return 0.0;
  
  // Chess.com uses 172 as the divisor for their logistic curve
  return 1 / (1 + Math.pow(10, -cp / 172));
}

// Calculate Expected Points Loss
// deltaPoints = winProb(best) - winProb(played)
export function calculateExpectedPointsLoss(
  bestEval: number,
  playedEval: number
): number {
  const bestWinProb = cpToWinProbability(bestEval);
  const playedWinProb = cpToWinProbability(playedEval);
  return Math.max(0, bestWinProb - playedWinProb);
}

// Base classification using Expected Points Loss
export function classifyMoveBase(deltaPoints: number): MoveClassification {
  if (deltaPoints <= 0.0) return 'best';
  if (deltaPoints <= 0.02) return 'excellent';
  if (deltaPoints <= 0.05) return 'good';
  if (deltaPoints <= 0.10) return 'inaccuracy';
  if (deltaPoints <= 0.20) return 'mistake';
  return 'blunder';
}

// Book move detection (opening theory)
export function isBookMove(
  moveNumber: number,
  evalCp: number
): boolean {
  // Early opening moves with near-zero eval (within 15 centipawns of equal)
  return moveNumber <= 12 && Math.abs(evalCp) <= 15;
}

// Main classification function with Brilliant/Great detection
export function classifyMove(
  deltaPoints: number,
  context: BrilliantContext
): MoveClassification {
  // Book moves take precedence
  if (context.moveNumber !== undefined && isBookMove(context.moveNumber, 0)) {
    return 'book';
  }

  // Brilliant: Sacrifice + depth gain + uniqueness + near-zero loss
  if (
    context.isSacrifice &&
    context.depthGain >= 0.5 &&
    context.uniqueness >= 0.8 &&
    deltaPoints <= 0.02
  ) {
    return 'brilliant';
  }

  // Great: NOT sacrifice + very low loss + high uniqueness + PV divergence
  if (
    !context.isSacrifice &&
    deltaPoints <= 0.01 &&
    context.uniqueness >= 0.7 &&
    context.pvDivergence !== undefined &&
    context.pvDivergence >= 0.4
  ) {
    return 'great';
  }

  // Fall back to base classification
  return classifyMoveBase(deltaPoints);
}

// Detect if a move is a sacrifice
// Material drop >= 3 points AND eval improves or stays winning
export function detectSacrifice(
  materialBefore: number,
  materialAfter: number,
  evalBefore: number,
  evalAfter: number
): boolean {
  const materialDrop = materialBefore - materialAfter;
  const isMaterialLoss = materialDrop >= 3;
  
  // Eval should improve or stay winning (>= 0 for white, <= 0 for black)
  const evalImproved = evalAfter >= evalBefore;
  
  return isMaterialLoss && evalImproved;
}

// Calculate material value (simplified)
export function calculateMaterial(fen: string): number {
  // Count pieces: Q=9, R=5, B=3, N=3, P=1
  const pieceValues: Record<string, number> = {
    'q': 9, 'r': 5, 'b': 3, 'n': 3, 'p': 1,
    'Q': 9, 'R': 5, 'B': 3, 'N': 3, 'P': 1
  };
  
  let material = 0;
  for (const char of fen.split(' ')[0]) {
    if (char in pieceValues) {
      const value = pieceValues[char];
      // White pieces are positive, black are negative
      material += char === char.toUpperCase() ? value : -value;
    }
  }
  
  return material;
}

// Calculate depth gain (difference between deep and shallow eval)
export function calculateDepthGain(
  shallowEval: number,
  deepEval: number
): number {
  // Normalize to centipawns if needed
  return Math.abs(deepEval - shallowEval) / 100;
}

// Calculate uniqueness from multipv results
// uniqueness = 1 - (eval2 - eval1) / max(abs(eval1), 1)
export function calculateUniqueness(
  bestEval: number,
  secondBestEval: number
): number {
  if (bestEval === secondBestEval) return 0;
  
  const evalDiff = Math.abs(secondBestEval - bestEval);
  const maxEval = Math.max(Math.abs(bestEval), 1);
  
  return Math.min(1, 1 - evalDiff / maxEval);
}

// Calculate PV divergence (difference between best and second-best opponent replies)
export function calculatePvDivergence(
  bestOpponentEval: number,
  secondBestOpponentEval: number
): number {
  if (bestOpponentEval === secondBestOpponentEval) return 0;
  
  const evalDiff = Math.abs(secondBestOpponentEval - bestOpponentEval);
  const maxEval = Math.max(Math.abs(bestOpponentEval), 1);
  
  return Math.min(1, evalDiff / maxEval);
}

// Badge styles matching Chess.com
export const BADGE_STYLES: Record<MoveClassification, { color: string; glow?: boolean }> = {
  brilliant: { color: '#1D4ED8', glow: true },
  great: { color: '#2563EB' },
  best: { color: '#10B981' },
  excellent: { color: '#22C55E' },
  good: { color: '#84CC16' },
  book: { color: '#38BDF8' },
  inaccuracy: { color: '#FACC15' },
  mistake: { color: '#FB923C' },
  blunder: { color: '#EF4444' },
  miss: { color: '#A855F7' }
};

// Get depth based on move number (auto-scaling)
export function getDepth(moveNumber: number): number {
  if (moveNumber < 10) return 16;
  if (moveNumber < 25) return 18;
  if (moveNumber < 40) return 20;
  return 22;
}

