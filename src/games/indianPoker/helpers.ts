import { IndianPokerPlayer, HandState, RoundState } from "./types";
export function getCurrentPlayer(hand: HandState): IndianPokerPlayer {
    let curr_idx: number = hand.currentPlayerIndex;
    let player_key: string = hand.playerOrder[curr_idx];
    let curr_player: IndianPokerPlayer = hand.players[player_key];
    return curr_player;
}

export function isPlayerTurn(
    hand: HandState,
    player: IndianPokerPlayer,
): boolean {
    return hand.playerOrder[hand.currentPlayerIndex] === player.id;
}

export function isHandOver(hand: HandState): boolean {
    return hand.isOver;
}

export function isRoundOver(round: RoundState) {
    if (round.cardsRemaining <= 10) {
        return true;
    }
    let count = 0;
    for (const player of Object.values(round.players) as IndianPokerPlayer[]) {
        if (player.stack > 0) {
            count += 1;
        }
    }
    return count <= 1;
}
