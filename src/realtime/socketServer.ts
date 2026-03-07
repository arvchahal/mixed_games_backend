import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom, updateRoomSettings } from "../rooms/roomManager";
import { joinRoom, handlePlayerAction, startRound, startNextHand, getRoomLedger, getViews } from "../rooms/roomService";
import { getRoom } from "../rooms/roomManager";
import { getEngine } from "../games/core/registry";
import { generatePlayerId } from "../utils/ids";
import { GameType } from "../games/core/registry";

export const httpServer = createServer((req, res) => {
    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
});
const corsOrigin = (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// roomId → active turn timeout
const turnTimers = new Map<string, ReturnType<typeof setTimeout>>();
const handTransitionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TURN_TIMEOUT_MS = 60_000;
const HAND_REVEAL_MS = 2500;

function clearTurnTimer(roomId: string) {
    const existing = turnTimers.get(roomId);
    if (existing) {
        clearTimeout(existing);
        turnTimers.delete(roomId);
    }
}

function clearHandTransitionTimer(roomId: string) {
    const existing = handTransitionTimers.get(roomId);
    if (existing) {
        clearTimeout(existing);
        handTransitionTimers.delete(roomId);
    }
}

// Mark round players who are disconnected as sitting_out so they skip the next deal.
function sitOutDisconnectedPlayers(roomId: string) {
    const room = getRoom(roomId);
    if (!room?.round) return;
    const roundPlayers = (room.round as { players?: Record<string, { sessionStatus: string }> }).players;
    if (!roundPlayers) return;
    for (const [pid, player] of Object.entries(roundPlayers)) {
        if (player.sessionStatus === "seated" && !playerSockets.has(pid)) {
            player.sessionStatus = "sitting_out";
        }
    }
}

function scheduleNextHand(roomId: string) {
    clearHandTransitionTimer(roomId);
    handTransitionTimers.set(
        roomId,
        setTimeout(() => {
            handTransitionTimers.delete(roomId);
            sitOutDisconnectedPlayers(roomId);
            const result = startNextHand(roomId);
            if (!result.error) {
                publishRoomState(roomId);
            }
        }, HAND_REVEAL_MS),
    );
}

function scheduleTurnTimer(roomId: string) {
    clearTurnTimer(roomId);
    const room = getRoom(roomId);
    if (!room || room.status !== "in_round" || !room.round) return;

    const engine = getEngine(room.gameType);
    if (engine.isHandOver(room.round)) return;

    const currentPlayerId = engine.getCurrentPlayerId(room.round);
    if (!currentPlayerId) return;

    // Away players are folded immediately; connected players get the full timer.
    const isAway = !playerSockets.has(currentPlayerId);

    turnTimers.set(
        roomId,
        setTimeout(() => {
            turnTimers.delete(roomId);
            const r = getRoom(roomId);
            if (!r || !r.round || r.status !== "in_round") return;
            const eng = getEngine(r.gameType);
            if (eng.isHandOver(r.round)) return;
            if (eng.getCurrentPlayerId(r.round) !== currentPlayerId) return;

            const result = handlePlayerAction(roomId, currentPlayerId, { type: "fold" });
            if (!result.error) {
                publishRoomState(roomId);
            }
        }, isAway ? 0 : TURN_TIMEOUT_MS),
    );
}

export const io = new Server(httpServer, {
    cors: {
        origin: corsOrigin,
    },
});

// playerId → socketId so we can send each player their own view (hidden info)
const playerSockets = new Map<string, string>();
// playerId → roomId so disconnect can find the player's room instantly
const playerRooms = new Map<string, string>();

function broadcastLobby(roomId: string) {
    const room = getRoom(roomId);
    if (!room) return;
    io.to(roomId).emit("lobby_update", {
        roomId: room.id,
        ownerId: room.ownerId,
        status: room.status,
        settings: room.settings,
        players: room.players.map((p) => ({ ...p, connected: playerSockets.has(p.id) })),
        pendingPlayers: room.pendingPlayers,
        ledger: getRoomLedger(room),
        chatMessages: room.chatMessages,
    });
}

function broadcastViews(roomId: string) {
    const room = getRoom(roomId);
    if (!room) return;
    const views = getViews(room);
    for (const [playerId, view] of Object.entries(views)) {
        const socketId = playerSockets.get(playerId);
        if (socketId) {
            io.to(socketId).emit("game_state", view);
        }
    }
}

function publishRoomState(roomId: string) {
    broadcastViews(roomId);

    const room = getRoom(roomId);
    if (!room) return;

    if (room.status === "lobby") {
        clearTurnTimer(roomId);
        clearHandTransitionTimer(roomId);
        broadcastLobby(roomId);
        return;
    }

    clearHandTransitionTimer(roomId);
    const engine = getEngine(room.gameType);
    if (room.round && engine.isHandOver(room.round)) {
        clearTurnTimer(roomId);
        scheduleNextHand(roomId);
        return;
    }

    scheduleTurnTimer(roomId);
}

io.on("connection", (socket) => {
    socket.on("create_room", (data) => {
        const displayName: string = data.display_name;
        const gameType: GameType = data.game_type;
        const settings: Record<string, unknown> = data.settings;
        const stack: number = (settings.stake as number) ?? 100;

        const playerId = generatePlayerId();
        const room = createRoom(playerId, displayName, gameType, settings, stack);

        playerSockets.set(playerId, socket.id);
        playerRooms.set(playerId, room.id);
        socket.join(room.id);
        socket.emit("room_created", { roomId: room.id, playerId });
        broadcastLobby(room.id);
    });

    socket.on("join_room", (data) => {
        const roomId: string = data.room_id;
        const displayName: string = data.display_name;
        const playerId: string = data.player_id ?? generatePlayerId();

        const room = getRoom(roomId);
        if (!room) {
            socket.emit("error", { message: "room not found" });
            return;
        }
        const stack: number = (room.settings.stake as number) ?? 100;

        const result = joinRoom(roomId, playerId, displayName, stack);
        if (result.error) {
            socket.emit("error", { message: result.error });
            return;
        }

        playerSockets.set(playerId, socket.id);
        playerRooms.set(playerId, roomId);
        socket.join(roomId);
        socket.emit("room_joined", { roomId, playerId });

        if (room.status === "in_round") {
            // Restore sitting_out status if they reconnect between hands
            const roundPlayers = (room.round as { players?: Record<string, { sessionStatus: string }> }).players;
            const roundPlayer = roundPlayers?.[playerId];
            if (roundPlayer?.sessionStatus === "sitting_out") {
                roundPlayer.sessionStatus = "seated";
            }

            // Reconnecting mid-round: push their current game view immediately
            // so they don't wait for the next action to see the table.
            const views = getViews(room);
            const playerView = views[playerId];
            if (playerView) socket.emit("game_state", playerView);
        }

        broadcastLobby(roomId);
    });

    socket.on("start_round", (data) => {
        const roomId: string = data.room_id;
        const playerId: string = data.player_id;

        const result = startRound(roomId, playerId);
        if (result.error) {
            socket.emit("error", { message: result.error });
            return;
        }

        publishRoomState(roomId);
    });

    socket.on("player_action", (data) => {
        const roomId: string = data.room_id;
        const playerId: string = data.player_id;
        const action: unknown = data.action; // { type: "fold" | "check" | "bet" | "call" | "raise", amount?: number }

        const result = handlePlayerAction(roomId, playerId, action);
        if (result.error) {
            socket.emit("error", { message: result.error });
            return;
        }

        publishRoomState(roomId);
    });

    socket.on("update_settings", (data) => {
        const roomId: string = data.room_id;
        const playerId: string = data.player_id;
        const settings: Record<string, unknown> = data.settings;

        const result = updateRoomSettings(roomId, playerId, settings);
        if (result.error) {
            socket.emit("error", { message: result.error });
            return;
        }

        broadcastLobby(roomId);
    });

    socket.on("chat_message", (data) => {
        const roomId: string = data.room_id;
        const playerId: string = data.player_id;
        const text: string = data.text;
        if (!text?.trim()) return;
        const room = getRoom(roomId);
        if (!room) return;
        const player = room.players.find((p) => p.id === playerId);
        if (!player) return;
        const message = { displayName: player.displayName, text: text.trim(), sentAt: Date.now() };
        room.chatMessages.push(message);
        room.chatMessages = room.chatMessages.slice(-100);
        io.to(roomId).emit("chat_message", message);
    });

    socket.on("transfer_ownership", (data) => {
        const roomId: string = data.room_id;
        const playerId: string = data.player_id;
        const targetId: string = data.target_id;

        const room = getRoom(roomId);
        if (!room) { socket.emit("error", { message: "room not found" }); return; }
        if (room.ownerId !== playerId) { socket.emit("error", { message: "only the owner can transfer" }); return; }
        if (!room.players.find((p) => p.id === targetId)) { socket.emit("error", { message: "player not found" }); return; }

        room.ownerId = targetId;
        broadcastLobby(roomId);
    });

    socket.on("disconnect", () => {
        let disconnectedPlayerId: string | null = null;
        for (const [playerId, socketId] of playerSockets.entries()) {
            if (socketId === socket.id) {
                disconnectedPlayerId = playerId;
                playerSockets.delete(playerId);
                break;
            }
        }
        if (disconnectedPlayerId) {
            const roomId = playerRooms.get(disconnectedPlayerId);
            if (roomId) {
                const room = getRoom(roomId);
                if (room) {
                    // If in a round and no players remain connected, return to lobby
                    if (room.status === "in_round") {
                        const anyConnected = room.players.some((p) => playerSockets.has(p.id));
                        if (!anyConnected) {
                            clearTurnTimer(roomId);
                            clearHandTransitionTimer(roomId);
                            room.status = "lobby";
                            room.round = null;
                        }
                    }
                    broadcastLobby(roomId);
                }
            }
        }
    });
});
