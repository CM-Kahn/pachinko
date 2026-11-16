export interface GameState {
  /** Balls the player has left to shoot. */
  ballsRemaining: number;
  /** Total balls won this session. */
  ballsAwarded: number;
  /** Best result, saved on the device (persistence arrives in Phase 3). */
  highScore: number;
}

export const STARTING_BALLS = 250;

export function newGameState(): GameState {
  return { ballsRemaining: STARTING_BALLS, ballsAwarded: 0, highScore: 0 };
}
