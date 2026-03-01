import { getRoom } from "./roomManager";
import { getEngine, AnyEngine } from "../games/core/registry";
import { Room, RoomPlayer } from "./roomTypes";
import { PlayerSeed, PlayerSummary } from "../games/core/engine";

type ServiceResult = { error?: string };

// ─── Player lifecycle ────────────────────────────────────────────────────────

export function joinRoom(
    roomId: string,
    playerId: string,
    displayName: string,
): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };

    const alreadyIn = [...room.players, ...room.pendingPlayers].some(
        (p) => p.id === playerId,
    );
    if (alreadyIn) return {}; // reconnect — no-op

    const player: RoomPlayer = { id: playerId, displayName, joinedAt: Date.now() };

    if (room.status === "lobby") {
        room.players.push(player);
    } else {
        room.pendingPlayers.push(player);
    }

    return {};
}

export function leaveRoom(roomId: string, playerId: string): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };

    room.players = room.players.filter((p) => p.id !== playerId);
    room.pendingPlayers = room.pendingPlayers.filter((p) => p.id !== playerId);

    if (room.players.length === 0) return {}; // room stays alive but empty

    // Transfer ownership to the earliest joiner if owner left
    if (room.ownerId === playerId) {
        const next = [...room.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
        room.ownerId = next.id;
    }

    return {};
}

// ─── Round lifecycle ─────────────────────────────────────────────────────────

export function startRound(roomId: string, requesterId: string): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };
    if (room.ownerId !== requesterId) return { error: "only the owner can start a round" };
    if (room.status === "in_round") return { error: "round already in progress" };
    if (room.players.length < 2) return { error: "need at least 2 players" };

    // Seat pending players
    room.players.push(...room.pendingPlayers);
    room.pendingPlayers = [];

    const engine = getEngine(room.gameType);
    const seeds: PlayerSeed[] = room.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isOwner: p.id === room.ownerId,
    }));

    const config = engine.buildRoundConfig(seeds, room.settings);
    let round = engine.createRound(config);
    round = engine.startHand(round);

    room.round = round;
    room.status = "in_round";

    return {};
}

// ─── Hand lifecycle ──────────────────────────────────────────────────────────

export function handlePlayerAction(
    roomId: string,
    playerId: string,
    action: unknown,
): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };
    if (!room.round) return { error: "no active round" };

    const engine = getEngine(room.gameType);

    const err = engine.validateAction(room.round, playerId, action);
    if (err) return { error: err };

    room.round = engine.applyAction(room.round, playerId, action);

    if (engine.isHandOver(room.round)) {
        room.round = engine.resolveHand(room.round);

        if (engine.isRoundOver(room.round)) {
            endRound(room);
        } else {
            room.round = engine.startHand(room.round);
        }
    }

    return {};
}

// ─── Internal ────────────────────────────────────────────────────────────────

function endRound(room: Room): void {
    room.status = "lobby";
    // Pending players will be seated on the next startRound call
}

// ─── View helpers (called by socket handlers after every state change) ────────

export function getViews(room: Room): Record<string, unknown> {
    if (!room.round) return {};
    const engine = getEngine(room.gameType);
    const views: Record<string, unknown> = {};
    for (const player of room.players) {
        try {
            views[player.id] = engine.getPlayerView(room.round, player.id);
        } catch {
            // player not in current hand (e.g. pending or eliminated)
        }
    }
    return views;
}

export function getRoundSummary(room: Room): PlayerSummary[] | null {
    if (!room.round) return null;
    const engine = getEngine(room.gameType);
    return engine.getRoundSummary(room.round);
}
