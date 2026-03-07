import { Room, RoomPlayer } from "./roomTypes";
import { GameType } from "../games/core/registry";
import { generateRoomURL } from "../utils/ids";

const rooms = new Map<string, Room>();

export function createRoom(
    ownerId: string,
    displayName: string,
    gameType: GameType,
    settings: Record<string, unknown>,
    stack: number,
): Room {
    let id = generateRoomURL();
    while (rooms.has(id)) {
        id = generateRoomURL();
    }

    const owner: RoomPlayer = {
        id: ownerId,
        displayName,
        joinedAt: Date.now(),
        stack,
        sessionTotalBuyIn: 0,
        sessionDelta: 0,
        seatIndex: 0,
    };

    const room: Room = {
        id,
        ownerId,
        gameType,
        settings,
        status: "lobby",
        players: [owner],
        pendingPlayers: [],
        chatMessages: [],
        round: null,
    };

    rooms.set(id, room);
    return room;
}

export function getRoom(roomId: string): Room | null {
    return rooms.get(roomId) ?? null;
}

export function updateRoomSettings(
    roomId: string,
    playerId: string,
    settings: Record<string, unknown>,
): { error?: string } {
    const room = rooms.get(roomId);
    if (!room) return { error: "room not found" };
    if (room.ownerId !== playerId) return { error: "only the owner can change settings" };
    if (room.status !== "lobby") return { error: "cannot change settings while a round is in progress" };

    const oldStake = Number(room.settings.stake) || 100;
    room.settings = { ...room.settings, ...settings };
    const newStake = Number(room.settings.stake) || 100;

    // Keep all player stacks in sync with the new stake so seat bubbles and
    // the ledger stay accurate and startRound gives everyone the right chips.
    if (newStake !== oldStake) {
        for (const player of [...room.players, ...room.pendingPlayers]) {
            player.stack = newStake;
        }
    }

    return {};
}
