export type MoveClassification = 
  | 'brilliant' 
  | 'best' 
  | 'good' 
  | 'inaccuracy' 
  | 'mistake' 
  | 'blunder' 
  | 'book'
  | 'forced';

export interface AnalyzedMove {
  moveNumber: number;
  san: string;
  from: string;
  to: string;
  color: 'w' | 'b';
  fen: string;
  evaluation: number;
  classification: MoveClassification;
  bestMove?: string;
  winChance: number;
}

export interface GameInfo {
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result?: string;
  event?: string;
  date?: string;
}

export interface AnalysisState {
  moves: AnalyzedMove[];
  currentMoveIndex: number;
  isAnalyzing: boolean;
  progress: number;
  whiteAccuracy: number;
  blackAccuracy: number;
  gameInfo: GameInfo;
}

export const CLASSIFICATION_CONFIG: Record<MoveClassification, {
  label: string;
  symbol: string;
  color: string;
  bgClass: string;
  textClass: string;
}> = {
  brilliant: {
    label: 'Brilliant',
    symbol: '!!',
    color: 'hsl(var(--move-brilliant))',
    bgClass: 'bg-move-brilliant',
    textClass: 'text-move-brilliant',
  },
  best: {
    label: 'Best',
    symbol: '★',
    color: 'hsl(var(--move-best))',
    bgClass: 'bg-move-best',
    textClass: 'text-move-best',
  },
  good: {
    label: 'Good',
    symbol: '✓',
    color: 'hsl(var(--move-good))',
    bgClass: 'bg-move-good',
    textClass: 'text-move-good',
  },
  inaccuracy: {
    label: 'Inaccuracy',
    symbol: '!?',
    color: 'hsl(var(--move-inaccuracy))',
    bgClass: 'bg-move-inaccuracy',
    textClass: 'text-move-inaccuracy',
  },
  mistake: {
    label: 'Mistake',
    symbol: '?',
    color: 'hsl(var(--move-mistake))',
    bgClass: 'bg-move-mistake',
    textClass: 'text-move-mistake',
  },
  blunder: {
    label: 'Blunder',
    symbol: '??',
    color: 'hsl(var(--move-blunder))',
    bgClass: 'bg-move-blunder',
    textClass: 'text-move-blunder',
  },
  book: {
    label: 'Book',
    symbol: '📖',
    color: 'hsl(var(--muted-foreground))',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
  },
  forced: {
    label: 'Forced',
    symbol: '□',
    color: 'hsl(var(--muted-foreground))',
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
  },
};

export const PIECE_ICONS: Record<string, string> = {
  'K': '♔',
  'Q': '♕',
  'R': '♖',
  'B': '♗',
  'N': '♘',
  'P': '♙',
  'k': '♚',
  'q': '♛',
  'r': '♜',
  'b': '♝',
  'n': '♞',
  'p': '♟',
};
