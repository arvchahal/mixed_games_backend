import { Room, RoomPlayer } from "./roomTypes";
import { GameType } from "../games/core/registry";
import { generateRoomURL } from "../utils/ids";

const rooms = new Map<string, Room>();

export function createRoom(
    ownerId: string,
    displayName: string,
    gameType: GameType,
    settings: Record<string, unknown>,
): Room {
    let id = generateRoomURL();
    while (rooms.has(id)) {
        id = generateRoomURL();
    }

    const owner: RoomPlayer = {
        id: ownerId,
        displayName,
        joinedAt: Date.now(),
    };

    const room: Room = {
        id,
        ownerId,
        gameType,
        settings,
        status: "lobby",
        players: [owner],
        pendingPlayers: [],
        round: null,
    };

    rooms.set(id, room);
    return room;
}

export function getRoom(roomId: string): Room | null {
    return rooms.get(roomId) ?? null;
}
