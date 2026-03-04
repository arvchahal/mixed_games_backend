import { httpServer } from "./realtime/socketServer";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

httpServer.listen(PORT, () => {
    console.log(`Socket.IO server listening on port ${PORT}`);
});
