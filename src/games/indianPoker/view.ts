import {
    IndianPokerPlayerView,
    OtherPlayerView,
    SelfPlayerView,
    RoundState,
    LedgerEntry,
} from "./types";

export function getPlayerView(
    round: RoundState,
    playerId: string,
): IndianPokerPlayerView {
    const hand = round.currentHand;
    if (!hand) {
        throw new Error("No active hand");
    }

    const players_filtered: Record<string, OtherPlayerView | SelfPlayerView> =
        {};
    for (const [id, player] of Object.entries(hand.players)) {
        const { card, ...rest } = player;
        const selfHasFolded = id === playerId && hand.players[id].handStatus === 'folded';
        if (id === playerId && !hand.isOver && !selfHasFolded) {
            players_filtered[id] = {
                ...rest,
                card: null,
            } satisfies SelfPlayerView;
        } else {
            players_filtered[id] = {
                ...rest,
                card: card!,
            } satisfies OtherPlayerView;
        }
    }

    const { players: _, ...handWithoutPlayers } = hand;

    const ledger: LedgerEntry[] = Object.values(round.players).map((p) => ({
        displayName: p.displayName,
        totalBuyIn: p.totalBuyIn,
        stack: p.stack,
        delta: p.stack - p.totalBuyIn,
    }));

    return {
        hand: { ...handWithoutPlayers, minRaise: hand.lastRaiseSize * 2, players: players_filtered },
        myId: playerId,
        myStack: round.players[playerId].stack,
        ledger,
    };
}
