import { GameEngine } from "../core/engine";
import {
    RoundState,
    IndianPokerAction,
    IndianPokerPlayerView,
    IndianPokerPlayer,
    IndianPokerRoundConfig,
} from "./types";
import { IndianPokerRules } from "./rules";
import { getPlayerView } from "./view";
import { isRoundOver } from "./helpers";
import { IndianPokerDeck } from "./deck";

const rules = new IndianPokerRules();

export class IndianPokerEngine
    implements
        GameEngine<
            RoundState,
            IndianPokerAction,
            IndianPokerPlayerView,
            IndianPokerRoundConfig
        >
{
    createRound(config: IndianPokerRoundConfig): RoundState {
        const players: Record<string, IndianPokerPlayer> = {};

        for (const player of config.players) {
            players[player.id] = {
                ...player,
                card: null,
                handStatus: "active",
                sessionStatus: "seated",
            };
        }

        const d = new IndianPokerDeck();
        d.build_deck();
        const deck = d.shuffle();

        return {
            players,
            currentHand: null,
            handHistory: [],
            deck,
            cardsRemaining: deck.length,
            smallBlind: config.smallBlind,
            bigBlind: config.bigBlind,
            stake: config.stake,
        };
    }

    startHand(round: RoundState): RoundState {
        const newRound: RoundState = structuredClone(round);

        // Only seated players with chips play
        const seated = Object.values(newRound.players).filter(
            (p) => p.sessionStatus === "seated" && p.stack > 0,
        );
        const playerOrder = seated.map((p) => p.id);

        // Advance button: find where the previous button player landed in the new order
        const prevHand = newRound.currentHand;
        let buttonIndex = 0;
        if (prevHand) {
            const prevButtonId = prevHand.playerOrder[prevHand.buttonIndex];
            const prevButtonNewIndex = playerOrder.indexOf(prevButtonId);
            // If eliminated, indexOf returns -1, so (−1 + 1) % n = 0 — naturally moves on
            buttonIndex = (prevButtonNewIndex + 1) % playerOrder.length;
        }

        const sbIndex = (buttonIndex + 1) % playerOrder.length;
        const bbIndex = (buttonIndex + 2) % playerOrder.length;
        // UTG is first to act; wraps correctly for 3-handed (lands on button) and 4+
        const utgIndex = (buttonIndex + 3) % playerOrder.length;

        // Deal one card per player, consuming from the round deck
        const handPlayers: Record<string, IndianPokerPlayer> = {};
        for (const player of seated) {
            const card = newRound.deck.pop()!;
            newRound.cardsRemaining--;
            handPlayers[player.id] = { ...player, card, handStatus: "active" };
        }

        // Post blinds (capped at stack for all-in situations)
        const sbId = playerOrder[sbIndex];
        const bbId = playerOrder[bbIndex];
        const sbAmount = Math.min(newRound.smallBlind, handPlayers[sbId].stack);
        const bbAmount = Math.min(newRound.bigBlind, handPlayers[bbId].stack);

        handPlayers[sbId].stack -= sbAmount;
        handPlayers[bbId].stack -= bbAmount;

        if (handPlayers[sbId].stack === 0) handPlayers[sbId].handStatus = "all in";
        if (handPlayers[bbId].stack === 0) handPlayers[bbId].handStatus = "all in";

        newRound.currentHand = {
            buttonIndex,
            pot: sbAmount + bbAmount,
            currentBet: bbAmount,
            lastRaiseSize: bbAmount,
            lastAggressorIndex: bbIndex, // BB is last to act if no raise comes
            currentPlayerIndex: utgIndex,
            playerOrder,
            players: handPlayers,
            isOver: false,
            winnerId: null,
        };

        return newRound;
    }

    applyAction(
        round: RoundState,
        playerId: string,
        action: IndianPokerAction,
    ): RoundState {
        const newRound: RoundState = structuredClone(round);
        const hand = newRound.currentHand!;
        const player = hand.players[playerId];

        switch (action.type) {
            case "fold": {
                player.handStatus = "folded";
                rules.foldedAcePenalty(player, hand);
                break;
            }
            case "check": {
                break;
            }
            case "call": {
                // call amount is capped at stack for all-in
                const amount = Math.min(hand.currentBet, player.stack);
                player.stack -= amount;
                hand.pot += amount;
                if (player.stack === 0) {
                    player.handStatus = "all in";
                }
                break;
            }
            case "bet": {
                player.stack -= action.amount;
                hand.pot += action.amount;
                hand.currentBet = action.amount;
                hand.lastRaiseSize = action.amount;
                hand.lastAggressorIndex = hand.currentPlayerIndex;
                break;
            }
            case "raise": {
                // amount is the raise increment, so total chips put in = currentBet + amount
                const total = hand.currentBet + action.amount;
                player.stack -= total;
                hand.pot += total;
                hand.currentBet += action.amount;
                hand.lastRaiseSize = action.amount;
                hand.lastAggressorIndex = hand.currentPlayerIndex;
                break;
            }
        }

        // Check if hand is over: only 1 (or 0) active players remain
        const activePlayers = hand.playerOrder.filter(
            (id) => hand.players[id].handStatus === "active",
        );
        if (activePlayers.length <= 1) {
            hand.isOver = true;
            return newRound;
        }

        // Advance to next active player
        let next = (hand.currentPlayerIndex + 1) % hand.playerOrder.length;
        while (hand.players[hand.playerOrder[next]].handStatus !== "active") {
            next = (next + 1) % hand.playerOrder.length;
        }
        hand.currentPlayerIndex = next;

        // Check if action has closed: returned to the last aggressor
        // Note: the "everyone checks" case requires lastAggressorIndex to be
        // initialized to the BB's index when the hand starts (handled in startHand)
        if (
            hand.lastAggressorIndex !== null &&
            hand.currentPlayerIndex === hand.lastAggressorIndex
        ) {
            hand.isOver = true;
        }

        return newRound;
    }

    validateAction(
        round: RoundState,
        playerId: string,
        action: IndianPokerAction,
    ): string | null {
        const hand = round.currentHand;
        if (!hand || hand.isOver) return "no active hand";

        const player = hand.players[playerId];
        if (!player) return "player not in hand";
        if (!rules.can_act(player, hand)) return "not your turn";

        switch (action.type) {
            case "fold":   return null; // always valid if it's your turn
            case "check":  return rules.can_check(player, hand)  ? null : "cannot check, there is a bet";
            case "call":   return rules.can_call(player, hand)   ? null : "nothing to call";
            case "bet":    return !rules.can_bet(player, hand)   ? "cannot bet" :
                                  !rules.isValidBetAmount(player, action.amount) ? "invalid bet amount" : null;
            case "raise":  return !rules.can_raise(player, hand) ? "cannot raise" :
                                  !rules.isValidRaiseAmount(player, hand, action.amount) ? "invalid raise amount" : null;
        }
    }

    getPlayerView(round: RoundState, playerId: string): IndianPokerPlayerView {
        return getPlayerView(round, playerId);
    }

    getHandWinner(round: RoundState): string | null {
        const hand = round.currentHand!;
        const contenders = Object.values(hand.players).filter(
            (p) => p.handStatus !== "folded",
        );
        const winner = rules.determine_winner(contenders);
        return winner?.id ?? null;
    }

    isRoundOver(round: RoundState): boolean {
        return isRoundOver(round);
    }
}
