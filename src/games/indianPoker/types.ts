import { Card } from "../core/types";

export type PlayerHandStatus = "active" | "all in" | "folded";
export type PlayerSessionStatus = "seated" | "pending" | "eliminated";

export type IndianPokerPlayer = {
  id: string;
  displayName: string;
  isOwner: boolean;
  stack: number;
  totalBuyIn: number;
  card: Card | null;
  handStatus: PlayerHandStatus;
  sessionStatus: PlayerSessionStatus;
};

export type HandState = {
  buttonIndex: number;
  pot: number;
  currentBet: number;
  lastAggressorIndex: number | null;
  currentPlayerIndex: number;
  playerOrder: string[];
  players: Record<string, IndianPokerPlayer>;
};

export type RoundState = {
  players: Record<string, IndianPokerPlayer>;
  currentHand: HandState | null;
  handHistory: HandResult[];
  cardsRemaining: number;
};

export type HandResult = {
  winnerId: string;
  pot: number;
};

export type IndianPokerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "bet"; amount: number }
  | { type: "call" }
  | { type: "raise"; amount: number };

export type IndianPokerPlayerView = {
  hand: HandState & {
    players: Record<
      string,
      Omit<IndianPokerPlayer, "card"> & { card: Card | null }
    >;
  };
  myStack: number;
};
