import { Chess } from 'chess.js';
// @ts-ignore
import { parse } from 'pgn-parser';

export interface GameHistoryItem {
  fen: string;
  move: string;
  san: string;
  color: 'w' | 'b';
  moveNumber: number;
  comments?: string[];
}

export interface ParsedGame {
  headers: Record<string, string>;
  history: GameHistoryItem[];
  result: string;
  chessInstance: Chess;
}

/**
 * Parses a PGN string and returns a structured game object.
 * Uses pgn-parser for structure and chess.js for rule validation and FEN generation.
 */
export function parsePgn(pgn: string): ParsedGame {
  const cleanPgn = pgn.trim();
  if (!cleanPgn) {
    throw new Error('PGN is empty');
  }

  // 1. Parse raw PGN structure
  let parsedCtx;
  try {
    const parsed = parse(cleanPgn);
    if (!parsed || parsed.length === 0) {
      throw new Error('No games found in PGN');
    }
    parsedCtx = parsed[0];
  } catch (e) {
    // Fallback: Try loading directly into chess.js if pgn-parser fails
    console.warn('pgn-parser failed, attempting direct chess.js load', e);
    const tempGame = new Chess();
    try {
        tempGame.loadPgn(cleanPgn);
    } catch {
        throw new Error('Invalid PGN format');
    }
    // If chess.js succeeds, we reconstruct the history manually below
    // But ideally we want pgn-parser for headers/comments
    return buildGameFromChessInstance(tempGame);
  }

  // 2. Extract Headers
  const headers: Record<string, string> = {};
  if (parsedCtx.headers) {
    parsedCtx.headers.forEach((h: any) => {
      if (h.name && h.value) {
        headers[h.name] = h.value;
      }
    });
  }

  // 3. Replay moves on Chess.js to validate and generate FENs
  const game = new Chess();
  
  // Set starting position if FEN header exists
  if (headers['FEN']) {
    game.load(headers['FEN']);
  }

  const history: GameHistoryItem[] = [];
  
  // Add initial state
  history.push({
    fen: game.fen(),
    move: 'Start',
    san: '',
    color: 'w',
    moveNumber: 0
  });

  const moves = parsedCtx.moves || [];
  
  for (const moveNode of moves) {
    const san = moveNode.move || moveNode.san;
    if (!san) continue;

    try {
      const moveResult = game.move(san);
      if (moveResult) {
        history.push({
          fen: game.fen(),
          move: moveResult.san,
          san: moveResult.san,
          color: moveResult.color,
          moveNumber: history.length,
          comments: moveNode.comments ? moveNode.comments.map((c: any) => c.text).filter(Boolean) : []
        });
      }
    } catch (e) {
      console.warn(`Skipping invalid move: ${san}`, e);
      // Stop parsing on first invalid move to prevent cascading errors
      break; 
    }
  }

  return {
    headers,
    history,
    result: headers['Result'] || '*',
    chessInstance: game
  };
}

/**
 * Fallback helper to build game structure directly from a Chess.js instance
 */
function buildGameFromChessInstance(game: Chess): ParsedGame {
  const history: GameHistoryItem[] = [];
  
  // Clone to replay
  const temp = new Chess();
  // Handle if the game started from a custom FEN
  // (Note: chess.js loadPgn usually handles this, but accessing history is easier from start)
  // For simplicity here, we assume standard start or headers are parsed by chess.js
  
  const headers = game.header();
  if (headers['FEN']) {
    temp.load(headers['FEN']);
  }

  history.push({
    fen: temp.fen(),
    move: 'Start',
    san: '',
    color: 'w',
    moveNumber: 0
  });

  const gameHistory = game.history({ verbose: true });
  gameHistory.forEach((move, i) => {
    temp.move(move);
    history.push({
      fen: temp.fen(),
      move: move.san,
      san: move.san,
      color: move.color,
      moveNumber: i + 1
    });
  });

  return {
    headers: headers as Record<string, string>,
    history,
    result: headers['Result'] || '*',
    chessInstance: game
  };
}
