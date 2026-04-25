import { networkManager } from "../index.js";
import { Packet } from "../Packet.js";
import { CharacterRenderHelper } from "../utils/CharacterRenderHelper.js";

let selectedIndex = -1;
const MAX_CHARACTER_SLOTS = 3;

async function buildSlot(character, index) {
    const hasCharacter = Boolean(character);

    const slot = document.createElement("div");
    slot.className = "char-slot";
    slot.dataset.index = index;

    let canvas = null;
    if (hasCharacter) {
        // Create character preview canvas
        canvas = await CharacterRenderHelper.createCharacterPreview(character, 200, 180, 60, 160);
        canvas.className = "char-slot-canvas";
        slot.appendChild(canvas);
    }

    const rerenderPreview = async () => {
        if (!hasCharacter || !canvas) {
            return;
        }
        const nextCanvas = await CharacterRenderHelper.createCharacterPreview(character, 200, 180, 60, 160);
        nextCanvas.className = "char-slot-canvas";
        canvas.replaceWith(nextCanvas);
        canvas = nextCanvas;
    };

    // Add character name below
    const name = document.createElement("span");
    name.className = "char-slot-name";
    name.textContent = hasCharacter ? character.name : "";
    slot.appendChild(name);

    const actions = document.createElement("div");
    actions.className = "char-slot-actions";

    const primaryBtn = document.createElement("button");
    primaryBtn.type = "button";
    primaryBtn.className = hasCharacter
        ? "char-slot-btn char-slot-btn-login"
        : "char-slot-btn char-slot-btn-create";
    primaryBtn.setAttribute("aria-label", hasCharacter ? `Login ${character.name}` : `Create in slot ${index + 1}`);

    primaryBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        document.querySelectorAll(".char-slot").forEach(s => s.classList.remove("char-slot-selected"));
        slot.classList.add("char-slot-selected");
        selectedIndex = index;

        if (hasCharacter) {
            document.dispatchEvent(new CustomEvent("ui:character-login", {
                detail: { character, index },
            }));

            const packet = new Packet(Packet.PacketFamily.CHARACTER, Packet.PacketAction.REQUEST);
            packet.addChar(index);
            networkManager.send(packet);
            return;
        }

        document.dispatchEvent(new CustomEvent("ui:message", {
            detail: {
                title: "Create Character",
                message: "Character creation UI will open here.",
            },
        }));
    });

    actions.appendChild(primaryBtn);

    if (hasCharacter) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "char-slot-btn char-slot-btn-delete";
        deleteBtn.setAttribute("aria-label", `Delete ${character.name}`);

        deleteBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            document.querySelectorAll(".char-slot").forEach(s => s.classList.remove("char-slot-selected"));
            slot.classList.add("char-slot-selected");
            selectedIndex = index;

            document.dispatchEvent(new CustomEvent("ui:message", {
                detail: {
                    title: "Delete Character",
                    message: "Delete is not wired to the server yet.",
                },
            }));
        });

        actions.appendChild(deleteBtn);
    }

    slot.appendChild(actions);

    slot.addEventListener("click", async () => {
        document.querySelectorAll(".char-slot").forEach(s => s.classList.remove("char-slot-selected"));
        slot.classList.add("char-slot-selected");
        selectedIndex = index;

        if (!hasCharacter) {
            return;
        }

        // Cycle facing direction: DOWN -> LEFT -> UP -> RIGHT -> DOWN
        const currentDirection = Number.isFinite(character.direction) ? character.direction : 0;
        const nextDirection = (currentDirection + 1) % 4;

        if (typeof character.setDirection === "function") {
            character.setDirection(nextDirection);
        } else {
            character.direction = nextDirection;
        }

        await rerenderPreview();
    });

    return slot;
}

export async function show(menu, characters) {
    selectedIndex = -1;
    menu.style.display = "none";

    const screen = document.createElement("div");
    screen.className = "char-screen";

    const list = document.createElement("div");
    list.className = "char-list";

    const slots = await Promise.all(
        Array.from({ length: MAX_CHARACTER_SLOTS }, (_, i) => buildSlot(characters[i] ?? null, i))
    );
    slots.forEach(slot => list.appendChild(slot));

    screen.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "char-actions";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "char-btn char-btn-back";
    backBtn.setAttribute("aria-label", "Back");

    backBtn.addEventListener("click", () => {
        screen.remove();
        menu.style.display = "";
    });

    actions.appendChild(backBtn);
    screen.appendChild(actions);

    document.body.appendChild(screen);
}