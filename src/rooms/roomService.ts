import { getRoom } from "./roomManager";
import { getEngine } from "../games/core/registry";
import { Room, RoomPlayer } from "./roomTypes";
import { PlayerSeed, PlayerSummary } from "../games/core/engine";

export type ServiceResult = { error?: string };
type LedgerEntry = {
    displayName: string;
    totalBuyIn: number;
    stack: number;
    delta: number;
};
type PlayerViewPayload = {
    myStack?: number;
    ledger?: LedgerEntry[];
};

export function joinRoom(
    roomId: string,
    playerId: string,
    displayName: string,
    stack: number,
): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };

    const existing = [...room.players, ...room.pendingPlayers].find(
        (p) => p.id === playerId,
    );
    if (existing) {
        // Don't overwrite stack on reconnect — it persists from their previous session
        return {};
    }

    const takenSeats = new Set([...room.players, ...room.pendingPlayers].map((p) => p.seatIndex));
    let seatIndex = 0;
    while (takenSeats.has(seatIndex)) seatIndex++;

    const player: RoomPlayer = {
        id: playerId,
        displayName,
        joinedAt: Date.now(),
        stack,
        sessionTotalBuyIn: 0,
        sessionDelta: 0,
        seatIndex,
    };

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
        const next = [...room.players].sort(
            (a, b) => a.joinedAt - b.joinedAt,
        )[0];
        room.ownerId = next.id;
    }

    return {};
}

export function startRound(roomId: string, requesterId: string): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };
    if (room.ownerId !== requesterId)
        return { error: "only the owner can start a round" };
    if (room.status === "in_round")
        return { error: "round already in progress" };
    if (room.players.length < 2) return { error: "need at least 2 players" };

    // Seat pending players
    room.players.push(...room.pendingPlayers);
    room.pendingPlayers = [];

    const roundStake = Number(room.settings.stake) || 100;
    for (const player of room.players) {
        player.sessionTotalBuyIn += roundStake;
    }

    const engine = getEngine(room.gameType);
    const seeds: PlayerSeed[] = room.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        isOwner: p.id === room.ownerId,
        stack: p.stack,
        seatIndex: p.seatIndex,
    }));

    const config = engine.buildRoundConfig(seeds, room.settings);
    let round = engine.createRound(config);
    round = engine.startHand(round);

    room.round = round;
    room.status = "in_round";

    return {};
}

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
        }
    }

    return {};
}

export function startNextHand(roomId: string): ServiceResult {
    const room = getRoom(roomId);
    if (!room) return { error: "room not found" };
    if (!room.round) return { error: "no active round" };
    if (room.status !== "in_round") return { error: "round not active" };

    const engine = getEngine(room.gameType);
    if (!engine.isHandOver(room.round)) return { error: "hand still active" };
    if (engine.isRoundOver(room.round)) return { error: "round is over" };

    room.round = engine.startHand(room.round);
    return {};
}

function endRound(room: Room): void {
    const nextStake = Number(room.settings.stake) || 100;
    const roundStake =
        typeof (room.round as { stake?: number } | null)?.stake === "number"
            ? ((room.round as { stake: number }).stake)
            : nextStake;
    const engine = getEngine(room.gameType);
    const summary = engine.getRoundSummary(room.round);
    for (const entry of summary) {
        const roomPlayer = room.players.find((p) => p.id === entry.id);
        if (!roomPlayer) continue;
        roomPlayer.sessionDelta += entry.finalStack - roundStake;
        roomPlayer.stack = nextStake;
    }
    room.status = "lobby";
}

export function getViews(room: Room): Record<string, unknown> {
    if (!room.round) return {};
    const engine = getEngine(room.gameType);
    const views: Record<string, unknown> = {};
    for (const player of room.players) {
        try {
            const view = engine.getPlayerView(room.round, player.id) as PlayerViewPayload & Record<string, unknown>;
            views[player.id] = {
                ...view,
                myStack: getDisplayedStack(room, player.id),
                ledger: getRoomLedger(room),
            };
        } catch {
            // player not in current hand (e.g. pending or eliminated)
        }
    }
    return views;
}

export function getRoomLedger(room: Room): LedgerEntry[] {
    // Use the stake the round was started with, not the current setting, so
    // the delta doesn't shift if the owner edits settings between hands.
    const settingsStake = Number(room.settings.stake) || 100;
    const roundStake = room.status === "in_round" && room.round
        ? (typeof (room.round as { stake?: number }).stake === "number"
            ? (room.round as { stake: number }).stake
            : settingsStake)
        : settingsStake;

    return room.players.map((player) => {
        const stack = getDisplayedStack(room, player.id);
        const inRoundDelta = room.status === "in_round" ? stack - roundStake : 0;
        const delta = player.sessionDelta + inRoundDelta;
        return {
            displayName: player.displayName,
            totalBuyIn: player.sessionTotalBuyIn,
            stack,
            delta: Math.round(delta * 100) / 100,
        };
    });
}

export function getRoundSummary(room: Room): PlayerSummary[] | null {
    if (!room.round) return null;
    const engine = getEngine(room.gameType);
    return engine.getRoundSummary(room.round);
}

function getDisplayedStack(room: Room, playerId: string): number {
    if (room.status === "in_round") {
        const handPlayer = (room.round as { currentHand?: { players?: Record<string, { stack: number }> } } | null)
            ?.currentHand?.players?.[playerId];
        if (typeof handPlayer?.stack === "number") {
            return handPlayer.stack;
        }
    }

    return room.players.find((player) => player.id === playerId)?.stack ?? 0;
}
