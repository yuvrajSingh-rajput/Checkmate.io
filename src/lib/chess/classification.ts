export enum Classification {
  BRILLIANT = "brilliant",
  GREAT = "great",
  BEST = "best",
  EXCELLENT = "excellent",
  GOOD = "good",
  INACCURACY = "inaccuracy",
  MISTAKE = "mistake",
  BLUNDER = "blunder",
  MISS = "miss",
  BOOK = "book",
  FORCED = "forced"
}

export const classificationValues = {
  "blunder": 0,
  "mistake": 0.2,
  "miss": 0.3,
  "inaccuracy": 0.4,
  "good": 0.65,
  "excellent": 0.9,
  "best": 1,
  "great": 1,
  "brilliant": 1,
  "book": 1,
  "forced": 1
}

// Classification types with no special rules
export const centipawnClassifications = [
  Classification.BEST,
  Classification.EXCELLENT,
  Classification.GOOD,
  Classification.INACCURACY,
  Classification.MISTAKE,
  Classification.BLUNDER
];

/**
 * Helper to get win probability from mate distance
 * Chess.com style: Mate positions saturate at 99.9% or 0.1%
 * @param mateIn - Mate distance (positive = White mates, negative = Black mates)
 * @returns Win probability (0 to 1)
 */
export function getMateWinProbability(mateIn: number): number {
  return mateIn > 0 ? 0.999 : 0.001;
}

/**
 * Helper to get winning chance from centipawns (0 to 1)
 * Uses the standard logistic curve: WinChance = 1 / (1 + 10^(-cp/400))
 * This matches Chess.com and Lichess methodology
 * @param centipawns - Evaluation in centipawns
 * @param mateIn - Optional mate distance (if evaluation is mate)
 */
export function getWinningChance(centipawns: number, mateIn?: number): number {
  if (mateIn !== undefined) {
    return getMateWinProbability(mateIn);
  }
  return 1 / (1 + Math.pow(10, -centipawns / 400));
}

/**
 * Helper to get centipawns from winning chance
 * Inverse of getWinningChance
 */
export function getCentipawns(chance: number): number {
  if (chance <= 0) return -Infinity;
  if (chance >= 1) return Infinity;
  return -400 * Math.log10(1 / chance - 1);
}

/**
 * Calculate win percentage loss from centipawn loss
 */
export function getWinPercentageLoss(prevCp: number, newCp: number): number {
  const prevChance = getWinningChance(prevCp);
  const newChance = getWinningChance(newCp);
  return (prevChance - newChance) * 100; // Return as percentage
}

/**
 * Get the evaluation loss threshold (in centipawns) for a classification
 * Uses Chess.com's Expected Points Model with exact thresholds
 *
 * Expected Points Lost thresholds:
 * - Best: 0.00 (no loss)
 * - Excellent: 0.00 to 0.02 (2% win chance loss)
 * - Good: 0.02 to 0.05 (5% win chance loss)
 * - Inaccuracy: 0.05 to 0.10 (10% win chance loss)
 * - Mistake: 0.10 to 0.20 (20% win chance loss)
 * - Blunder: 0.20+ (20%+ win chance loss)
 *
 * @param classif - The classification to get threshold for
 * @param prevEval - Previous evaluation in centipawns (from moving side's perspective)
 * @returns Maximum centipawn loss allowed for this classification
 */
export function getEvaluationLossThreshold(classif: Classification, prevEval: number): number {
  const currentChance = getWinningChance(prevEval);

  // Define exact expected points loss thresholds (as decimals)
  let allowedWinChanceLoss = 0;

  switch (classif) {
    case Classification.BEST:
      allowedWinChanceLoss = 0.00;
      break;
    case Classification.EXCELLENT:
      allowedWinChanceLoss = 0.02; // 2% win chance loss
      break;
    case Classification.GOOD:
      allowedWinChanceLoss = 0.05; // 5% win chance loss
      break;
    case Classification.INACCURACY:
      allowedWinChanceLoss = 0.10; // 10% win chance loss
      break;
    case Classification.MISTAKE:
      allowedWinChanceLoss = 0.20; // 20% win chance loss
      break;
    case Classification.BLUNDER:
      return Infinity; // Anything worse than mistake
    default:
      return Infinity;
  }

  // Calculate target win chance after allowed loss
  const targetChance = Math.max(0, currentChance - allowedWinChanceLoss);
  const targetCp = getCentipawns(targetChance);

  if (targetCp === -Infinity) return Infinity;

  // Return the CP threshold (mover loses if post < prev - threshold)
  return Math.max(0, prevEval - targetCp);
}

/**
 * Get Expected Points Lost (EPL) for accuracy weighting
 * EPL = win chance of best move - win chance of actual move
 * @param bestPostCp - Best move evaluation (mover-relative)
 * @param actualPostCp - Actual move evaluation (mover-relative)
 * @param bestMateIn - Optional mate distance for best move
 * @param actualMateIn - Optional mate distance for actual move
 */
export function getEPL(
  bestPostCp: number, 
  actualPostCp: number,
  bestMateIn?: number,
  actualMateIn?: number
): number {
  const bestChance = getWinningChance(bestPostCp, bestMateIn);
  const actualChance = getWinningChance(actualPostCp, actualMateIn);
  return bestChance - actualChance;  // 0-1 scale
}

/**
 * Check if a move should be classified as a "miss"
 * A miss is when the player failed to find a strong tactical opportunity
 * 
 * Chess.com criteria:
 * - Best move is tactical (mate or >= +3.0 advantage)
 * - Gap between PV1 and PV2 >= 2.0 pawns
 * - EPL >= 0.10
 * - Played move not PV1
 * - Played move loses >= 1.5 pawns vs PV1
 * 
 * @param bestPostEval - Best move evaluation (mover-relative cp)
 * @param secondBestPostEval - Second best move evaluation (mover-relative cp)
 * @param playedPostEval - Evaluation after played move (mover-relative cp)
 * @param bestMateIn - Mate distance for best move (mover-relative: positive = mover mates)
 * @param secondBestMateIn - Mate distance for second best move (mover-relative)
 * @param playedMateIn - Mate distance for played move (mover-relative)
 * @param playedMoveUCI - UCI of the move that was played
 * @param bestMoveUCI - UCI of the best move
 */
export function shouldBeMiss(
  bestPostEval: number,
  secondBestPostEval: number,
  playedPostEval: number,
  bestMateIn?: number,
  secondBestMateIn?: number,
  playedMateIn?: number,
  playedMoveUCI?: string,
  bestMoveUCI?: string
): boolean {
  // If played move is the best move, not a miss
  if (playedMoveUCI && bestMoveUCI && playedMoveUCI === bestMoveUCI) {
    return false;
  }

  // Calculate EPL (must be >= 0.10 for miss)
  const epl = getEPL(bestPostEval, playedPostEval, bestMateIn, playedMateIn);
  if (epl < 0.10) {
    return false;
  }

  // Check if best move is tactical (mate in <= 5 moves OR >= +3.0 pawns)
  const isBestMate = bestMateIn !== undefined && bestMateIn > 0 && bestMateIn <= 5;
  const isBestTactical = bestPostEval >= 300 || isBestMate;
  
  if (!isBestTactical) {
    return false;
  }

  // Check gap between best and second best (must be >= 2.0 pawns)
  // For mate positions, compare mate depths
  let tacticalGap = 0;
  if (bestMateIn !== undefined && secondBestMateIn !== undefined) {
    // Both are mate: gap is difference in mate distance
    tacticalGap = Math.abs(bestMateIn - secondBestMateIn) * 100; // Rough conversion
  } else if (bestMateIn !== undefined) {
    // Best is mate, second is not: huge gap
    tacticalGap = 500; // Large gap
  } else {
    // Both are CP: use direct difference
    tacticalGap = Math.abs(bestPostEval - secondBestPostEval);
  }
  
  if (tacticalGap < 200) { // 2.0 pawns
    return false;
  }

  // Check if played move loses >= 1.5 pawns vs best
  // For mate positions, compare mate depths
  let evalLoss = 0;
  if (bestMateIn !== undefined && playedMateIn !== undefined) {
    // Both are mate: loss is difference in mate distance
    evalLoss = (bestMateIn - playedMateIn) * 100; // Rough conversion
  } else if (bestMateIn !== undefined) {
    // Best is mate, played is not: huge loss
    evalLoss = 500; // Large loss
  } else {
    // Both are CP: use direct difference
    evalLoss = bestPostEval - playedPostEval;
  }
  
  return evalLoss >= 150; // 1.5 pawns
}