import {
    IndianPokerPlayerView,
    OtherPlayerView,
    SelfPlayerView,
    RoundState,
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
        if (id === playerId) {
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

    return {
        hand: { ...handWithoutPlayers, players: players_filtered },
        myId: playerId,
        myStack: round.players[playerId].stack,
    };
}
