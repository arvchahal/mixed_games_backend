export interface GameEngine<TState, TAction, TPlayerView, TRoundConfig> {
    createRound(config: TRoundConfig): TState;
    applyAction(state: TState, playerId: string, action: TAction): TState;
    getPlayerView(state: TState, playerId: string): TPlayerView;
    getHandWinner(state: TState): string | null;
    isRoundOver(state: TState): boolean;
}
