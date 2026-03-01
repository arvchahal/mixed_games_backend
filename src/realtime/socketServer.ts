import { createServer } from "http";
import { Server } from "socket.io";
import { createRoom } from "../rooms/roomManager.ts";
import { GameType } from "../games/core/registry";
const httpServer = createServer();

//below is temp
export const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
    },
});

//abvoe is temp

io.on("connection", (socket) => {
    socket.on("create room", (data) => {
        const owner_id: string = data.player_id;
        const display_name: string = data.display_name;
        const game_type: GameType = data.game_type;
        const settings: Record<string, unknown> = data.settings;

        const room = createRoom(owner_id, display_name, game_type, settings);

        socket.join(room.id);
        socket.emit("room created", room);
    });

    socket.on("join room", (room_id) => {
        socket.join(room_id);
        socket.emit("joined room", { room_id });
    });
});
