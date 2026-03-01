import { GameEngine } from "./engine";
import { IndianPokerEngine } from "../indianPoker/engine";

export type GameType = "indianPoker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEngine = GameEngine<any, any, any, any>;

const registry = new Map<GameType, AnyEngine>([
    ["indianPoker", new IndianPokerEngine()],
]);

export function getEngine(gameType: GameType): AnyEngine {
    const engine = registry.get(gameType);
    if (!engine) throw new Error(`No engine registered for game type: ${gameType}`);
    return engine;
}
