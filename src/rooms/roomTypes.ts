import { GameType } from "../games/core/registry";

export type RoomStatus = "lobby" | "in_round";

export type RoomPlayer = {
    id: string;
    displayName: string;
    joinedAt: number; // Date.now() — used for ownership transfer order
    stack: number;
    sessionTotalBuyIn: number;
    sessionDelta: number;
    seatIndex: number;
};

export type RoomChatMessage = {
    displayName: string;
    text: string;
    sentAt: number;
};

export type Room = {
    id: string;
    ownerId: string;
    gameType: GameType;
    settings: Record<string, unknown>; // game-specific config (stake, blinds, etc.)
    status: RoomStatus;
    players: RoomPlayer[];
    pendingPlayers: RoomPlayer[]; // joined mid-round, seated at next round start
    chatMessages: RoomChatMessage[];
    round: unknown; // managed entirely through the engine, never accessed directly
};
