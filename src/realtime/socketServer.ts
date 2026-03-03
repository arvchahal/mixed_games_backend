import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom } from "../rooms/roomManager";
import { joinRoom, handlePlayerAction, startRound, getViews } from "../rooms/roomService";
import { getRoom } from "../rooms/roomManager";
import { generatePlayerId } from "../utils/ids";
import { GameType } from "../games/core/registry";

const httpServer = createServer();

export const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
    },
});

// playerId → socketId so we can send each player their own view (hidden info)
const playerSockets = new Map<string, string>();

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

io.on("connection", (socket) => {
    socket.on("create_room", (data) => {
        const displayName: string = data.display_name;
        const gameType: GameType = data.game_type;
        const settings: Record<string, unknown> = data.settings;

        const playerId = generatePlayerId();
        const room = createRoom(playerId, displayName, gameType, settings);

        playerSockets.set(playerId, socket.id);
        socket.join(room.id);
        socket.emit("room_created", { roomId: room.id, playerId });
    });

    socket.on("join_room", (data) => {
        const roomId: string = data.room_id;
        const displayName: string = data.display_name;
        const playerId: string = data.player_id ?? generatePlayerId();

        const result = joinRoom(roomId, playerId, displayName);
        if (result.error) {
            socket.emit("error", { message: result.error });
            return;
        }

        playerSockets.set(playerId, socket.id);
        socket.join(roomId);
        socket.emit("room_joined", { roomId, playerId });
    });

    socket.on("start_round", (data) => {
        const roomId: string = data.room_id;
        const playerId: string = data.player_id;

        const result = startRound(roomId, playerId);
        if (result.error) {
            socket.emit("error", { message: result.error });
            return;
        }

        broadcastViews(roomId);
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

        broadcastViews(roomId);
    });

    socket.on("disconnect", () => {
        for (const [playerId, socketId] of playerSockets.entries()) {
            if (socketId === socket.id) {
                playerSockets.delete(playerId);
                break;
            }
        }
    });
});
