// import { BasicRules } from "../core/rules.ts";
import { cardValue } from "../core/helpers";
import { IndianPokerPlayer, HandState } from "./types";
import { getCurrentPlayer } from "./helpers";
export class IndianPokerRules {
    determine_winner(
        players: Array<IndianPokerPlayer>,
    ): IndianPokerPlayer | undefined {
        if (players.length == 0) {
            return;
        }
        let max_val: number = -1;
        let winner: IndianPokerPlayer | undefined = undefined;
        for (const player of players) {
            if (player.card && cardValue(player.card) > max_val) {
                max_val = cardValue(player.card);
                winner = player;
            }
        }
        return winner;
    }
    can_act(player: IndianPokerPlayer, hand: HandState): boolean {
        if (getCurrentPlayer(hand) != player) {
            return false;
        }
        if (
            player.handStatus != "active" ||
            player.sessionStatus != "seated" ||
            player.stack <= 0
        ) {
            return false;
        }
        return true;
    }
    can_bet(player: IndianPokerPlayer, hand: HandState): boolean {
        if (
            hand.currentBet == 0 &&
            this.can_act(player, hand) &&
            player.stack > 0
        ) {
            return true;
        }
        return false;
    }

    can_raise(player: IndianPokerPlayer, hand: HandState): boolean {
        if (!this.can_act(player, hand) || hand.currentBet === 0) return false;
        const toMatch = hand.currentBet - player.currentBetAmount;
        return toMatch < player.stack; // has chips left after matching
    }
    can_call(player: IndianPokerPlayer, hand: HandState): boolean {
        if (!this.can_act(player, hand) || hand.currentBet === 0) return false;
        return hand.currentBet > player.currentBetAmount; // something to call
    }
    can_check(player: IndianPokerPlayer, hand: HandState): boolean {
        // Player can check whenever they owe nothing: no bet, or already matched (BB option)
        return this.can_act(player, hand) && player.currentBetAmount >= hand.currentBet;
    }
    isValidBetAmount(player: IndianPokerPlayer, amount: number): boolean {
        return amount > 0 && amount <= player.stack;
    }
    isValidRaiseAmount(
        player: IndianPokerPlayer,
        hand: HandState,
        amount: number,
    ): boolean {
        if (amount <= 0) return false;
        const toMatch = hand.currentBet - player.currentBetAmount;
        const totalToAdd = toMatch + amount;
        if (totalToAdd > player.stack) return false;    // can't put in more than stack
        if (totalToAdd >= player.stack) return true;   // all-in is always valid
        const minRaiseSize = hand.lastRaiseSize * 2;
        return amount >= minRaiseSize;
    }

    foldedAcePenalty(player: IndianPokerPlayer, hand: HandState): void {
        if (
            player.handStatus === "folded" &&
            player.card &&
            player.card.rank == "A"
        ) {
            player.stack = Math.round(player.stack / 2 * 100) / 100;
            hand.pot = Math.round((hand.pot + player.stack) * 100) / 100;
        }
    }
}
