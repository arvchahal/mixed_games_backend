import { IndianPokerPlayer, HandState } from "./types";
export function getCurrentPlayer(hand: HandState): IndianPokerPlayer {
    let curr_idx: number = hand.currentPlayerIndex;
    let adjusted_idx: number = curr_idx % Object.keys(hand.players).length;
    let player_key: string = hand.playerOrder[adjusted_idx];
    let curr_player: IndianPokerPlayer = hand.players[player_key];
    return curr_player;
}
