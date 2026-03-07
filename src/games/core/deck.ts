import { Card } from "./types";

export interface Deck {
    Cards: Card[];
    build_deck(): void;
    draw(): Card | undefined;
    shuffle(): Card[];
}
