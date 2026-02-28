// import { BasicRules } from "../core/rules.ts";
import { cardValue } from "../core/helpers";
import { IndianPokerPlayer, HandState } from "./types";
import { getCurrentPlayer } from "./helpers";
class IndianPokerRules {
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
        if (this.can_act(player, hand) && hand.currentBet > 0 && hand.currentBet < player.stack) {
            return true;
        }
        return false;
    }
    can_call(player: IndianPokerPlayer, hand: HandState): boolean {
        if (this.can_act(player, hand) && hand.currentBet > 0 && hand.currentBet <= player.stack) {
            return true;
        }
        return false;
    }
    can_check(player: IndianPokerPlayer, hand: HandState): boolean {
        return this.can_act(player, hand) && hand.currentBet === 0;
    }
    isValidBetAmount(player: IndianPokerPlayer, amount: number): boolean {
        return amount > 0 && amount <= player.stack;
    }
    isValidRaiseAmount(
        player: IndianPokerPlayer,
        hand: HandState,
        amount: number,
    ): boolean {
        if (amount > player.stack || amount <= 0) {
            return false;
        }
        if (amount == player.stack) {
            return true;
        }
        let min_raise_size = hand.lastRaiseSize * 2;
        if (player.stack < min_raise_size) {
            return false;
        }
        return amount >= min_raise_size;
    }

    foldedAcePenalty(player: IndianPokerPlayer, hand: HandState): void {
        if (
            player.handStatus === "folded" &&
            player.card &&
            player.card.rank == "A"
        ) {
            player.stack /= 2;
            hand.pot += player.stack;
        }
    }
}
