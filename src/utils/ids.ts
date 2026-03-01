import { customAlphabet } from "nanoid";

export function generateRoomURL(): string {
    const generateJoinCode = customAlphabet(
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
        8,
    );
    return generateJoinCode();
}
export function generatePlayerId(): string {
    const generatePlayerCode = customAlphabet(
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
        6,
    );
    return generatePlayerCode();
}
