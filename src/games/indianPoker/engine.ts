import { GameEngine } from "../core/engine";
import { HandState, IndianPokerAction, IndianPokerPlayerView } from "./types";
export class IndianPokerEngine
    implements GameEngine<HandState, RoundState, IndianPokerPlayerView> {}
