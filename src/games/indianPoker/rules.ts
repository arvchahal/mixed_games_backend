// import { BasicRules } from "../core/rules.ts";
import { cardValue } from "../core/helpers";
import { IndianPokerPlayer, HandState} from "./types";
import {getCurrentPlayer} from "./helpers"
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
    can_act(player: IndianPokerPlayer, hand:HandState): boolean {
        if (getCurrentPlayer(hand)!= player){
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
    can_bet(player: IndianPokerPlayer): boolean{

    }
    can_reraise(player:IndianPokerPlayer): boolean{

    }
    can_call(player: IndianPokerPlayer, bet number): boolean{
        if (this.can_act(player){
            if(bet)
        }
    }
}
