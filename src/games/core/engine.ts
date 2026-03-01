export type PlayerSeed = {
    id: string;
    displayName: string;
    isOwner: boolean;
};

export type PlayerSummary = {
    id: string;
    displayName: string;
    totalBuyIn: number;
    finalStack: number;
    delta: number;
};

export interface GameEngine<TState, TAction, TPlayerView, TRoundConfig> {
    buildRoundConfig(players: PlayerSeed[], settings: Record<string, unknown>): TRoundConfig;
    createRound(config: TRoundConfig): TState;
    startHand(state: TState): TState;
    applyAction(state: TState, playerId: string, action: TAction): TState;
    validateAction(state: TState, playerId: string, action: unknown): string | null;
    resolveHand(state: TState): TState;
    isHandOver(state: TState): boolean;
    isRoundOver(state: TState): boolean;
    getHandWinner(state: TState): string | null;
    getPlayerView(state: TState, playerId: string): TPlayerView;
    getRoundSummary(state: TState): PlayerSummary[];
}
