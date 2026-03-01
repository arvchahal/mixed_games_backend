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
  lastRaiseSize: number;
  isOver: boolean;
  winnerId: string | null;
};

export type RoundState = {
  players: Record<string, IndianPokerPlayer>;
  currentHand: HandState | null;
  handHistory: HandResult[];
  deck: Card[];
  cardsRemaining: number;
  smallBlind: number;
  bigBlind: number;
  stake: number;
};

export type HandResult = {
  winnerId: string;
  pot: number;
};

export type IndianPokerRoundConfig = {
  players: IndianPokerPlayer[];
  stake: number;
  smallBlind: number;
  bigBlind: number;
};

export type IndianPokerAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "bet"; amount: number }
  | { type: "call" }
  | { type: "raise"; amount: number };

export type OtherPlayerView = Omit<IndianPokerPlayer, "card"> & {
  card: Card;
};

export type SelfPlayerView = Omit<IndianPokerPlayer, "card"> & {
  card: null;
};

export type IndianPokerPlayerView = {
  hand: Omit<HandState, "players"> & {
    players: Record<string, OtherPlayerView | SelfPlayerView>;
  };
  myId: string;
  myStack: number;
};
