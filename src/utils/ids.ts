import { randomInt } from "crypto";

function randomFromAlphabet(alphabet: string, length: number): string {
    let result = "";
    for (let i = 0; i < length; i += 1) {
        result += alphabet[randomInt(0, alphabet.length)];
    }
    return result;
}

export function generateRoomURL(): string {
    return randomFromAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
}
export function generatePlayerId(): string {
    return randomFromAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
}
