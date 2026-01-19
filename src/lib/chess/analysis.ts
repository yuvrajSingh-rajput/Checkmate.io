import { Chess, Square } from "chess.js";

import { EvaluatedPosition } from "../../types/Position";
import Report from "../../types/Report";

import {
    Classification, 
    centipawnClassifications, 
    classificationValues, 
    getEvaluationLossThreshold,
    shouldBeMiss,
    getEPL,
    getWinningChance
} from "./classification";
import { InfluencingPiece, getAttackers, isPieceHanging, pieceValues, promotions } from "./board";

import openings from "../../resources/openings.json";

// Board cache to prevent memory leaks
const boardCache = new Map<string, Chess>();
function getCachedBoard(fen: string): Chess {
    if (!boardCache.has(fen)) {
        if (boardCache.size > 100) {
            // Clear oldest entries
            const firstKey = boardCache.keys().next().value;
            boardCache.delete(firstKey);
        }
        boardCache.set(fen, new Chess(fen));
    }
    return boardCache.get(fen)!;
}

async function analyse(positions: EvaluatedPosition[]): Promise<Report> {
    
    // Clear board cache at start
    boardCache.clear();
    
    // Generate classifications for each position
    let positionIndex = 0;
    for (let position of positions.slice(1)) {

        positionIndex++;

        let board = getCachedBoard(position.fen);

        let lastPosition = positions[positionIndex - 1];

        let topMove = lastPosition.topLines.find(line => line.id == 1);
        let secondTopMove = lastPosition.topLines.find(line => line.id == 2);
        if (!topMove) continue;

        // Get evaluation BEFORE the move (position before move was played)
        let previousEvaluation = lastPosition.topLines.find(line => line.id == 1)?.evaluation;
        // Get evaluation AFTER the move (current position)
        let evaluation = position.topLines.find(line => line.id == 1)?.evaluation;
        if (!previousEvaluation) continue;

        // Determine who moved (FEN shows whose turn it is NOW, so opposite color moved)
        const moveColor = position.fen.includes(" b ") ? "white" : "black";
        /**
         * Color conversion rules (CRITICAL; fixes eval sign flipping):
         *
         * - Stockfish evaluations are ALWAYS WHITE-RELATIVE:
         *   +cp means better for White, -cp means better for Black.
         *   mateIn > 0 means White mates, mateIn < 0 means Black mates.
         *
         * - We keep ALL stored / propagated evals strictly WHITE-RELATIVE.
         *   We convert to MOVER-RELATIVE ONLY as local temporaries for:
         *   - Expected Points Loss (EPL)
         *   - WinningChance
         *   - Classification thresholds
         *   - GREAT / BRILLIANT leniency logic
         *
         * - Conversion to MOVER-RELATIVE:
         *   moverMultiplier = +1 if mover is White, -1 if mover is Black
         *   moverRelativeCp = whiteRelativeCp * moverMultiplier
         *   moverRelativeMateIn = whiteRelativeMateIn * moverMultiplier
         *
         * IMPORTANT: `previousEvaluation` belongs to the OPPOSITE color of the
         * current move (it is the eval from the previous ply context in our model),
         * so its mover-relative conversion must use `prevMoverMultiplier`, NOT the
         * current `moverMultiplier`. This is exactly what prevents the
         * +0.8 → -0.8 → +0.8 flip on stable positions.
         */
        const moverMultiplier = moveColor == "white" ? 1 : -1;
        const prevMoverMultiplier = -moverMultiplier;

        // If there are no legal moves in this position, game is in terminal state
        if (!evaluation) {
            evaluation = { type: board.isCheckmate() ? "mate" : "cp", value: 0 };
            position.topLines.push({
                id: 1,
                depth: 0,
                evaluation: evaluation,
                moveUCI: ""
            });
        }

        // CRITICAL: Chess.com Expected Points Model
        // All engine evaluations are WHITE-RELATIVE, convert to MOVER-RELATIVE locally only.
        
        // bestAfter = PV1 evaluation from previous position (after best move would be played)
        // This is the evaluation of the position AFTER the best move from lastPosition
        const bestAfterWhite = topMove.evaluation.value; // WHITE-RELATIVE
        const bestMateInWhite = topMove.evaluation.mateIn; // WHITE-RELATIVE (positive = White mates)
        
        // playedAfter = evaluation of actual played move (current position)
        // This is the evaluation of the position AFTER the actual move was played
        const playedAfterWhite = evaluation?.value || 0; // WHITE-RELATIVE
        const playedMateInWhite = evaluation?.mateIn; // WHITE-RELATIVE
        
        // Convert to MOVER-RELATIVE for EPL / thresholds / classifications (local only)
        const bestAfterMover = bestAfterWhite * moverMultiplier;
        const playedAfterMover = playedAfterWhite * moverMultiplier;
        
        // Mate distances also need the SAME conversion rule as CP.
        // After conversion: + means mover mates, - means opponent mates.
        const bestMateInMover = bestMateInWhite !== undefined ? bestMateInWhite * moverMultiplier : undefined;
        const playedMateInMover = playedMateInWhite !== undefined ? playedMateInWhite * moverMultiplier : undefined;
        
        // Calculate Expected Points Loss (EPL) with mate support
        // EPL = WinProb(best) - WinProb(played)
        // Both probabilities are from mover's perspective
        const WinProbBest = getWinningChance(bestAfterMover, bestMateInMover);
        const WinProbPlayed = getWinningChance(playedAfterMover, playedMateInMover);
        const EPL = WinProbBest - WinProbPlayed;
        
        // Store WHITE-RELATIVE only (never store color-flipped values for future plies)
        // These stored values MUST NOT flip sign just because the side-to-move changes.
        (position as any).bestAfterWhite = bestAfterWhite;
        (position as any).playedAfterWhite = playedAfterWhite;
        (position as any).bestMateInWhite = bestMateInWhite;
        (position as any).playedMateInWhite = playedMateInWhite;
        (position as any).prevEvalWhite = previousEvaluation.value || 0;
        (position as any).prevMateInWhite = previousEvaluation.mateIn;
        (position as any).EPL = EPL;

        // Check if this move was the only legal one (FORCED)
        // If there's only one legal move, it's forced
        const legalMoves = board.moves({ verbose: false });
        if (legalMoves.length <= 1 || (!secondTopMove && legalMoves.length === 1)) {
            position.classification = Classification.FORCED;
            continue;
        }

        // Defensive: MultiPV PV2 line can exist but be malformed (missing evaluation) if upstream data was partial.
        // Avoid crashing; treat as FORCED-like (no reliable alternative line to compare).
        if (secondTopMove && !(secondTopMove as any).evaluation) {
            console.warn('[analyse] Missing PV2 evaluation; falling back to FORCED', {
                fen: position.fen,
                move: position.move?.uci,
            });
            position.classification = Classification.FORCED;
            continue;
        }

        // Chess.com Classification Rules using EPL
        
        // BEST: EPL == 0 OR played move == PV1
        if (EPL <= 0.0001 || topMove.moveUCI == position.move.uci) {
            position.classification = Classification.BEST;
        } else {
            // Check for missed tactical opportunities first (MISS classification)
            // Extract second best move evaluation in mover-relative
            const secondBestAfterWhite = secondTopMove?.evaluation?.value ?? bestAfterWhite;
            const secondBestAfterMover = secondBestAfterWhite * moverMultiplier;
            const secondBestMateInWhite = secondTopMove?.evaluation?.mateIn;
            const secondBestMateInMover = secondBestMateInWhite !== undefined ? secondBestMateInWhite * moverMultiplier : undefined;
            
            if (shouldBeMiss(
                bestAfterMover,
                secondBestAfterMover,
                playedAfterMover,
                bestMateInMover,
                secondBestMateInMover,
                playedMateInMover,
                position.move.uci,
                topMove.moveUCI
            )) {
                position.classification = Classification.MISS;
            } else {
                // Classification based on EPL thresholds (Chess.com exact thresholds)
                if (EPL <= 0.02) {
                    position.classification = Classification.EXCELLENT;
                } else if (EPL <= 0.05) {
                    position.classification = Classification.GOOD;
                } else if (EPL <= 0.10) {
                    position.classification = Classification.INACCURACY;
                } else if (EPL <= 0.20) {
                    position.classification = Classification.MISTAKE;
                } else {
                    position.classification = Classification.BLUNDER;
                }
            }
        }

        // If current verdict is BEST, check for GREAT or BRILLIANT
        if (position.classification == Classification.BEST) {
            // GREAT: Only move to avoid losing OR turning point OR punishes blunder
            try {
                const secondBestAfterWhite = secondTopMove?.evaluation.value || 0;
                const secondBestAfterMover = secondBestAfterWhite * moverMultiplier;
                
                // Previous evaluation belongs to the opposite color of the current move.
                // Convert using prevMoverMultiplier (NOT moverMultiplier) to keep semantics consistent.
                const prevEvalWhite = previousEvaluation.value || 0; // WHITE-RELATIVE
                const prevMateInWhite = previousEvaluation.mateIn; // WHITE-RELATIVE
                const prevEvalMover = prevEvalWhite * prevMoverMultiplier;
                const prevMateInMover = prevMateInWhite !== undefined ? prevMateInWhite * prevMoverMultiplier : undefined;
                
                // Convert previous evaluation to mover-relative win probability for comparison
                const prevWinProb = getWinningChance(prevEvalMover, prevMateInMover);
                
                // Only move to avoid losing (PV2 much worse than PV1)
                const onlyGoodMove = secondBestAfterMover < -200 && bestAfterMover >= -100;
                
                // Turning point detection: losing → equal, equal → winning, losing → winning
                // Use win probability for more accurate detection
                const wasLosing = prevWinProb <= 0.15; // ~-150cp equivalent
                const nowEqual = Math.abs(playedAfterMover) <= 50 && playedMateInMover === undefined;
                const wasEqual = Math.abs(prevEvalMover) <= 50 && prevMateInMover === undefined;
                const nowWinning = playedAfterMover >= 150 || (playedMateInMover !== undefined && playedMateInMover > 0);
                const isTurningPoint = (wasLosing && nowEqual) || (wasEqual && nowWinning) || (wasLosing && nowWinning);
                
                // Punishes opponent blunder with large eval swing
                const opponentBlundered = lastPosition.classification == Classification.BLUNDER;
                const significantGap = Math.abs(bestAfterWhite - secondBestAfterWhite) >= 200;
                
                if (onlyGoodMove || isTurningPoint || (opponentBlundered && significantGap)) {
                    position.classification = Classification.GREAT;
                }
            } catch {}
            
            // BRILLIANT: Only if still BEST (not upgraded to GREAT) and sacrifice detected
            if (position.classification == Classification.BEST) {
                // Must be winning for the side that played the brilliancy
                const secondBestAfterWhite = secondTopMove?.evaluation.value || 0;
                const secondBestAfterMover = secondBestAfterWhite * moverMultiplier;
                
                // Not brilliant if already trivially winning (second best also winning)
                const winningAnyways = (
                    (bestMateInMover !== undefined && bestMateInMover > 0 && secondBestAfterMover >= 300)
                    || (bestMateInMover === undefined && bestAfterMover >= 300 && secondBestAfterMover >= 300)
                );

                // Must be winning position, not trivially winning, and not a promotion
                if (playedAfterMover >= 0 && !winningAnyways && !position.move.san.includes("=")) {
                    let lastBoard = new Chess(lastPosition.fen);
                    let currentBoard = new Chess(position.fen);
                    
                    // Not brilliant if in check (forced move)
                    if (lastBoard.isCheck()) {
                        // Skip brilliancy check
                    } else {
                        // Check what piece was captured (if any)
                        const capturedSquare = position.move.uci.slice(2, 4) as Square;
                        let lastPiece = lastBoard.get(capturedSquare);
                        if (!lastPiece) {
                            // No capture, check if piece left hanging
                            const movedFrom = position.move.uci.slice(0, 2) as Square;
                            // If still missing (shouldn't happen), leave as null/undefined and guard uses below.
                            lastPiece = lastBoard.get(movedFrom);
                        }

                        let sacrificedPieces: InfluencingPiece[] = [];
                        const files = ["a","b","c","d","e","f","g","h"];
                        const ranks = ["8","7","6","5","4","3","2","1"];
                        
                        // Check all pieces of the mover's color for hanging pieces
                        for (let r = 0; r < 8; r++) {
                            for (let f = 0; f < 8; f++) {
                                const piece = currentBoard.board()[r][f];
                                if (!piece) continue;
                                
                                const square = (files[f] + ranks[r]) as Square;
                                
                                if (piece.color != moveColor.charAt(0)) continue;
                                if (piece.type == "k" || piece.type == "p") continue;

                                // If the piece just captured is of higher or equal value than the candidate
                                // hanging piece, not hanging, better trade happening somewhere else
                                if (lastPiece && pieceValues[lastPiece.type] >= pieceValues[piece.type]) {
                                    continue;
                                }

                                // If the piece is hanging after the move, potential sacrifice
                                if (isPieceHanging(lastPosition.fen, position.fen, square)) {
                                    sacrificedPieces.push({ ...piece, square });
                                }
                            }
                        }

                        // If no sacrifices detected, not brilliant
                        if (sacrificedPieces.length === 0) {
                            // Not brilliant
                        } else {
                            // Check if sacrifice is viable (not just a forced recapture)
                            let anyPieceViablyCapturable = false;
                            let captureTestBoard = new Chess(position.fen);

                            for (let piece of sacrificedPieces) {
                                let attackers = getAttackers(position.fen, piece.square);

                                for (let attacker of attackers) {
                                    for (let promotion of promotions) {
                                        try {
                                            captureTestBoard.move({
                                                from: attacker.square,
                                                to: piece.square,
                                                promotion: promotion
                                            });

                                            // If the capture leads to an enemy piece of greater or equal value
                                            // being hung (attacker is pinned), not brilliant
                                            let attackerPinned = false;
                                            for (let r = 0; r < 8; r++) {
                                                for (let f = 0; f < 8; f++) {
                                                    const enemyPiece = captureTestBoard.board()[r][f];
                                                    if (!enemyPiece) continue;

                                                    const square = (files[f] + ranks[r]) as Square;

                                                    if (enemyPiece.color == captureTestBoard.turn()) continue;
                                                    if (enemyPiece.type == "k" || enemyPiece.type == "p") continue;
                    
                                                    if (
                                                        isPieceHanging(position.fen, captureTestBoard.fen(), square)
                                                        && pieceValues[enemyPiece.type] >= Math.max(...sacrificedPieces.map(sack => pieceValues[sack.type]))
                                                    ) {
                                                        attackerPinned = true;
                                                        break;
                                                    }
                                                }
                                                if (attackerPinned) break;
                                            }
                                            
                                            // If the sacked piece is a rook or more in value, given brilliant
                                            // regardless of taking it leading to mate in 1. If it less than a
                                            // rook, only give brilliant if its capture cannot lead to mate in 1
                                            if (pieceValues[piece.type] >= 5) {
                                                if (!attackerPinned) {
                                                    anyPieceViablyCapturable = true;
                                                    break;
                                                }
                                            } else if (
                                                !attackerPinned
                                                && !captureTestBoard.moves().some(move => move.endsWith("#"))
                                            ) {
                                                anyPieceViablyCapturable = true;
                                                break;
                                            }

                                            captureTestBoard.undo();
                                        } catch {}
                                    }

                                    if (anyPieceViablyCapturable) break;
                                }

                                if (anyPieceViablyCapturable) break;
                            }

                            // Only brilliant if sacrifice is real (piece can be captured without immediate compensation)
                            if (anyPieceViablyCapturable) {
                                position.classification = Classification.BRILLIANT;
                            }
                        }
                    }
                }
            }
        }

        // Do not allow blunder if move still completely winning (Chess.com rule)
        if (position.classification == Classification.BLUNDER && playedAfterMover >= 600) {
            position.classification = Classification.GOOD;
        }

        // Do not allow blunder if you were already in a completely lost position (Chess.com rule)
        if (
            position.classification == Classification.BLUNDER 
            && bestAfterMover <= -600
        ) {
            position.classification = Classification.GOOD;
        }

        position.classification ??= Classification.BOOK;

    }

    // Generate opening names for named positions
    for (let position of positions) {
        let opening = openings.find(opening => position.fen.includes(opening.fen));
        position.opening = opening?.name;
    }

    // Apply book moves for opening theory
    // BOOK: Only while opening known AND EPL < 0.01
    // Stop immediately when any non-book loss occurs
    let bookEnded = false;
    for (let position of positions.slice(1)) {
        if (bookEnded) {
            break;
        }
        
        const EPL = (position as any).EPL || 0;
        const hasOpening = position.opening;
        
        if (hasOpening && EPL < 0.01) {
            position.classification = Classification.BOOK;
        } else {
            bookEnded = true;
        }
    }

    // Generate SAN moves from all engine lines
    // This is used for the engine suggestions card on the frontend
    for (let position of positions) {
        for (let line of position.topLines) {
            if (line.evaluation.type == "mate" && line.evaluation.value == 0) continue;

            let board = new Chess(position.fen);

            try {
                line.moveSAN = board.move({
                    from: line.moveUCI.slice(0, 2),
                    to: line.moveUCI.slice(2, 4),
                    promotion: line.moveUCI.slice(4) || undefined
                }).san;
            } catch {
                line.moveSAN = "";
            }
        }
    }

    // Calculate computer accuracy percentages
    let accuracies = {
        white: {
            current: 0,
            maximum: 0
        },
        black: {
            current: 0,
            maximum: 0
        }
    };
    const classifications = {
        white: {
            brilliant: 0,
            great: 0,
            best: 0,
            excellent: 0,
            good: 0,
            inaccuracy: 0,
            mistake: 0,
            miss: 0,
            blunder: 0,
            book: 0,
            forced: 0,
        },
        black: {
            brilliant: 0,
            great: 0,
            best: 0,
            excellent: 0,
            good: 0,
            inaccuracy: 0,
            mistake: 0,
            miss: 0,
            blunder: 0,
            book: 0,
            forced: 0,
        }
    };

    for (let position of positions.slice(1)) {
        const moveColor = position.fen.includes(" b ") ? "white" : "black";
        const moverMultiplier = moveColor == "white" ? 1 : -1;
        const prevMoverMultiplier = -moverMultiplier;

        // EPL-weighted accuracy calculation (Chess.com model)
        // Skip book and forced moves
        if (position.classification !== Classification.BOOK && position.classification !== Classification.FORCED) {
            const EPL = (position as any).EPL || 0;
            // IMPORTANT: we only stored WHITE-RELATIVE values on the position.
            // `prevEvalWhite` belongs to the opposite color context of this move, so convert
            // to mover-relative using `prevMoverMultiplier` (not `moverMultiplier`).
            const prevEvalWhite = (position as any).prevEvalWhite || 0;
            const prevMateInWhite = (position as any).prevMateInWhite;
            const prevEvalMover = prevEvalWhite * prevMoverMultiplier;
            const prevMateInMover = prevMateInWhite !== undefined ? prevMateInWhite * prevMoverMultiplier : undefined;
            
            // Leniency factor if position was already losing (mover-relative <= -100cp)
            // Chess.com applies leniency when position was already losing
            // Use win probability for more accurate detection
            const prevWinProb = getWinningChance(prevEvalMover, prevMateInMover);
            const wasAlreadyLosing = prevWinProb <= 0.15; // ~-150cp equivalent or worse
            const leniencyFactor = wasAlreadyLosing ? 0.7 : 1.0;
            
            // Accuracy contribution: 100 - (EPL * 100 * leniency)
            // EPL is already 0-1 scale (win probability loss)
            const moveAccuracy = Math.max(0, Math.min(100, 100 - (EPL * 100 * leniencyFactor)));
            
            accuracies[moveColor].current += moveAccuracy;
            accuracies[moveColor].maximum += 100; // Each move out of 100
        }

        classifications[moveColor][position.classification!] += 1;
    }

    // Return complete report
    return {
        accuracies: {
            white: accuracies.white.maximum > 0 ? (accuracies.white.current / accuracies.white.maximum) * 100 : 100,
            black: accuracies.black.maximum > 0 ? (accuracies.black.current / accuracies.black.maximum) * 100 : 100
        },
        classifications,
        positions: positions
    };

}

export default analyse;