// src/utils/analysisLogic.ts

export interface MoveClassification {
    label: string;
    color: string;
}

// Convert centipawns (cp) to a win percentage (0 to 1)
export const calculateWinChance = (centipawns: number): number => {
    // If mate is found (e.g., 3000), set max/min probability
    if (centipawns > 1000) return 1;
    if (centipawns < -1000) return 0;
    
    const chance = 1 / (1 + Math.pow(10, -centipawns / 400));
    return chance;
};

// Classify the move (Great, Blunder, etc.)
export const classifyMove = (
    prevScore: number, 
    currentScore: number, 
    moveColor: 'w' | 'b'
): MoveClassification => {
    // Normalize scores so positive is always "Good for the current player"
    const multiplier = moveColor === 'w' ? 1 : -1;
    
    const prevWin = calculateWinChance(prevScore * multiplier);
    const currentWin = calculateWinChance(currentScore * multiplier);
    const delta = prevWin - currentWin; // How much win probability did we lose?

    if (delta <= 0.01) return { label: 'Best', color: '#95b645' }; // Improved or stayed same
    if (delta < 0.02) return { label: 'Excellent', color: '#96bc4b' };
    if (delta < 0.05) return { label: 'Good', color: '#96bc4b' };
    if (delta < 0.1) return { label: 'Inaccuracy', color: '#f0c15c' };
    if (delta < 0.2) return { label: 'Mistake', color: '#e58f2a' };
    return { label: 'Blunder', color: '#ca3431' };
};