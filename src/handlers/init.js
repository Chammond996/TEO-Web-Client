import { PlaySFX } from "../../main.js";
import { Packet } from "../Packet.js";

const initMessageSpritePath = "./sprites/gfx001/118.png";

function removeInitMessage() {
    const existing = document.querySelector(".init-message-overlay");
    if (existing) {
        existing.remove();
    }
}

export function showInitMessage(message, titleText = "Connection Failed") {
    removeInitMessage();

    const overlay = document.createElement("div");
    overlay.className = "init-message-overlay";

    const box = document.createElement("div");
    box.className = "init-message-box";
    box.style.backgroundImage = `url(${initMessageSpritePath})`;

    const title = document.createElement("h3");
    title.className = "init-message-title";
    title.textContent = titleText;

    const body = document.createElement("p");
    body.className = "init-message-body";
    body.textContent = message;

    const okButton = document.createElement("button");
    okButton.type = "button";
    okButton.className = "init-message-ok";
    okButton.setAttribute("aria-label", "OK");
    okButton.addEventListener("click", () => {
        overlay.remove();
    });

    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(okButton);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

export function handleInitReply(payload) {
    let offset = 0;
    const [status, nextOffset] = Packet.getChar(payload, offset);
    offset = nextOffset;

    let connectionType = null;
    if (payload.length > offset) {
        const [type] = Packet.getChar(payload, offset);
        connectionType = type;
    }

    if(status !== 1) {
        showInitMessage( status == 5 ? "Client version mismatch." : "Failed to connect to the server.");
        PlaySFX(2);
    }

    document.dispatchEvent(new CustomEvent("network:init", {
        detail: {
            status,
            connectionType,
        },
    }));
}
