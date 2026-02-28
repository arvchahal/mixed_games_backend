import { RANK_VALUES, SUIT_VALUES, Card } from "./types";

export function cardValue(card: Card): number {
    return RANK_VALUES[card.rank] + SUIT_VALUES[card.suit];
}
