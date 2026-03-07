import { GameEngine, PlayerSeed, PlayerSummary } from "../core/engine";
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
const round2 = (n: number) => Math.round(n * 100) / 100;

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
            handPlayers[player.id] = { ...player, card, handStatus: "active", currentBetAmount: 0 };
        }

        // Post blinds (capped at stack for all-in situations)
        const sbId = playerOrder[sbIndex];
        const bbId = playerOrder[bbIndex];
        const sbAmount = Math.min(newRound.smallBlind, handPlayers[sbId].stack);
        const bbAmount = Math.min(newRound.bigBlind, handPlayers[bbId].stack);

        handPlayers[sbId].stack -= sbAmount;
        handPlayers[sbId].currentBetAmount = sbAmount;
        handPlayers[bbId].stack -= bbAmount;
        handPlayers[bbId].currentBetAmount = bbAmount;

        if (handPlayers[sbId].stack === 0) handPlayers[sbId].handStatus = "all in";
        if (handPlayers[bbId].stack === 0) handPlayers[bbId].handStatus = "all in";

        newRound.currentHand = {
            buttonIndex,
            pot: sbAmount + bbAmount,
            currentBet: bbAmount,
            lastRaiseSize: bbAmount,
            lastAggressorIndex: null, // no aggressor yet; BB gets their option
            streetOpenIndex: utgIndex, // action closes when we return here with no raise
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
                // only pay the difference between currentBet and what player already put in
                const toCall = round2(Math.min(hand.currentBet - player.currentBetAmount, player.stack));
                player.stack = round2(player.stack - toCall);
                hand.pot = round2(hand.pot + toCall);
                player.currentBetAmount = round2(player.currentBetAmount + toCall);
                if (player.stack <= 0) {
                    player.stack = 0;
                    player.handStatus = "all in";
                }
                break;
            }
            case "bet": {
                const betAmt = round2(action.amount);
                player.stack = round2(player.stack - betAmt);
                hand.pot = round2(hand.pot + betAmt);
                player.currentBetAmount = round2(player.currentBetAmount + betAmt);
                hand.currentBet = betAmt;
                hand.lastRaiseSize = betAmt;
                hand.lastAggressorIndex = hand.currentPlayerIndex;
                if (player.stack <= 0) { player.stack = 0; player.handStatus = "all in"; }
                break;
            }
            case "raise": {
                // amount is the raise increment above currentBet
                // player only pays what they haven't yet contributed
                const raiseAmt = round2(action.amount);
                const toMatch = round2(hand.currentBet - player.currentBetAmount);
                const toAdd = round2(toMatch + raiseAmt);
                player.stack = round2(player.stack - toAdd);
                hand.pot = round2(hand.pot + toAdd);
                player.currentBetAmount = round2(player.currentBetAmount + toAdd);
                hand.currentBet = round2(hand.currentBet + raiseAmt);
                hand.lastRaiseSize = raiseAmt;
                hand.lastAggressorIndex = hand.currentPlayerIndex;
                if (player.stack <= 0) { player.stack = 0; player.handStatus = "all in"; }
                break;
            }
        }

        // If everyone but one player has folded, the hand is immediately over.
        const nonFoldedPlayers = hand.playerOrder.filter(
            (id) => hand.players[id].handStatus !== "folded",
        );
        if (nonFoldedPlayers.length <= 1) {
            hand.isOver = true;
            return newRound;
        }

        const activePlayers = hand.playerOrder.filter(
            (id) => hand.players[id].handStatus === "active",
        );
        if (activePlayers.length === 0) {
            hand.isOver = true;
            return newRound;
        }

        // One active player plus one or more all-in players is only over once
        // the active player has matched the current bet.
        if (activePlayers.length === 1) {
            const loneActiveId = activePlayers[0];
            const loneActive = hand.players[loneActiveId];
            hand.currentPlayerIndex = hand.playerOrder.indexOf(loneActiveId);
            if (round2(loneActive.currentBetAmount) === round2(hand.currentBet)) {
                hand.isOver = true;
            }
            return newRound;
        }

        // Advance to next active player
        let next = (hand.currentPlayerIndex + 1) % hand.playerOrder.length;
        while (hand.players[hand.playerOrder[next]].handStatus !== "active") {
            next = (next + 1) % hand.playerOrder.length;
        }
        hand.currentPlayerIndex = next;

        // Check if action has closed.
        // Case 1: a raise happened and aggressor is still active — close when we return to them.
        // Case 2: no raise (everyone called/checked) — close when we return to
        //         streetOpenIndex, meaning BB has had their option and checked.
        // Case 3: aggressor went all-in — close once every active player has matched.
        const aggressorPlayer =
            hand.lastAggressorIndex !== null
                ? hand.players[hand.playerOrder[hand.lastAggressorIndex]]
                : null;
        const aggressorIsActive = aggressorPlayer?.handStatus === "active";

        const isBackToAggressor =
            hand.lastAggressorIndex !== null &&
            aggressorIsActive &&
            hand.currentPlayerIndex === hand.lastAggressorIndex;
        const isBackToStreetOpen =
            hand.lastAggressorIndex === null &&
            hand.currentPlayerIndex === hand.streetOpenIndex;
        const allInAggressorSettled =
            hand.lastAggressorIndex !== null &&
            !aggressorIsActive &&
            activePlayers.every(
                (id) =>
                    round2(hand.players[id].currentBetAmount) >=
                    round2(hand.currentBet),
            );

        if (isBackToAggressor || isBackToStreetOpen || allInAggressorSettled) {
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

    buildRoundConfig(players: PlayerSeed[], settings: Record<string, unknown>): IndianPokerRoundConfig {
        const stake = settings.stake as number;
        const smallBlind = settings.smallBlind as number;
        const bigBlind = settings.bigBlind as number;

        const builtPlayers: IndianPokerPlayer[] = players.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            isOwner: p.isOwner,
            stack: p.stack,
            totalBuyIn: p.stack,
            card: null,
            handStatus: "active" as const,
            sessionStatus: "seated" as const,
            seatIndex: p.seatIndex,
            currentBetAmount: 0,
        }));

        return { players: builtPlayers, stake, smallBlind, bigBlind };
    }

    isHandOver(round: RoundState): boolean {
        return round.currentHand?.isOver ?? false;
    }

    resolveHand(round: RoundState): RoundState {
        const newRound = structuredClone(round);
        const hand = newRound.currentHand!;

        const winnerId = this.getHandWinner(newRound);
        if (winnerId) {
            hand.players[winnerId].stack += hand.pot;
            hand.winnerId = winnerId;
        }

        // Sync hand stacks back to round players
        for (const [id, handPlayer] of Object.entries(hand.players)) {
            newRound.players[id].stack = handPlayer.stack;
        }

        // Record hand result
        if (winnerId) {
            newRound.handHistory.push({ winnerId, pot: hand.pot });
        }

        // Eliminate busted players
        for (const player of Object.values(newRound.players)) {
            if (player.stack === 0) {
                player.sessionStatus = "eliminated";
            }
        }

        return newRound;
    }

    getRoundSummary(round: RoundState): PlayerSummary[] {
        return Object.values(round.players).map((p) => ({
            id: p.id,
            displayName: p.displayName,
            totalBuyIn: p.totalBuyIn,
            finalStack: p.stack,
            delta: p.stack - p.totalBuyIn,
        }));
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

    getCurrentPlayerId(round: RoundState): string | null {
        const hand = round.currentHand;
        if (!hand || hand.isOver) return null;
        return hand.playerOrder[hand.currentPlayerIndex] ?? null;
    }
}
