export interface GameEngine<TState, TAction, TPlayerView> {
    createRound(playerIds: string[]): TState;
    applyAction(state: TState, playerId: string, action: TAction): TState;
    getPlayerView(state: TState, playerId: string): TPlayerView;
    getRoundWinner(state: TState): string | null;
    isRoundOver(state: TState): boolean;
}
