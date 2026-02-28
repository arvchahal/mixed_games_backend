export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
] as const;
export type Rank = (typeof RANKS)[number];

export type Card = {
  rank: Rank;
  suit: Suit;
};

export const RANK_VALUES: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export const SUIT_VALUES: Record<Suit, number> = {
  clubs: 0.1,
  diamonds: 0.2,
  hearts: 0.3,
  spades: 0.4,
};
