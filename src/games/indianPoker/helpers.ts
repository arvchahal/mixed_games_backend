import { IndianPokerPlayer, HandState } from "./types";
export function getCurrentPlayer(hand: HandState): IndianPokerPlayer {
    let curr_idx: number = hand.currentPlayerIndex;
    let player_key: string = hand.playerOrder[curr_idx];
    let curr_player: IndianPokerPlayer = hand.players[player_key];
    return curr_player;
}
