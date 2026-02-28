import { Deck } from "../core/deck";
import { Card, SUITS, RANKS } from "../core/types";
export class IndianPokerDeck implements Deck {
    Cards: Array<Card> = [];
    build_deck(): void {
        if (this.Cards.length > 0) {
            return;
        }
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.Cards.push({ suit, rank });
            }
        }
    }
    draw() {
        //specific to Indian Poker
        if (this.Cards.length <= 9) {
            return undefined;
        }
        return this.Cards.pop();
    }
    shuffle() {
        const result: Array<Card> = [...this.Cards];

        for (let i = result.length - 1; i > 0; i--) {
            const randomBuffer = new Uint32Array(1);
            crypto.getRandomValues(randomBuffer);

            // Normalize to 0 - i
            const j = randomBuffer[0] % (i + 1);

            // Swap elements
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}
