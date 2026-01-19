import { Classification } from "../lib/chess/classification";

export interface Evaluation {
    type: "cp" | "mate",
    value: number,
    mateIn?: number  // Mate distance (positive = White mates, negative = Black mates)
}

export interface EngineLine {
    id: number,
    depth: number,
    evaluation: Evaluation,
    moveUCI: string,
    moveSAN?: string
}

export interface Move {
    uci: string,
    san: string
}

export interface EvaluatedPosition {
    fen: string,
    move: Move,
    topLines: EngineLine[],
    classification?: Classification,
    opening?: string,
    worker?: string,
    cutoffEvaluation?: Evaluation
}