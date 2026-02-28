import { Card } from "./types";

export interface Deck {
    Cards: Array<Card>;
    draw(): Card | undefined;
    shuffle(): Array<Card>;
}
