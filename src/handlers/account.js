import { Packet } from "../Packet.js";

export function handleAccountReply(payload) {
    let offset = 0;
    const [resultCode, nextOffset] = Packet.getChar(payload, offset);
    offset = nextOffset;

    let message = "Account request failed.";
    if (payload.length > offset) {
        const [serverMessage] = Packet.getString(payload, offset);
        message = serverMessage;
    }

    document.dispatchEvent(new CustomEvent("network:account-reply", {
        detail: {
            success: resultCode === 1,
            resultCode,
            message,
        },
    }));
}
