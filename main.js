import * as CreateAccount from "./src/screens/CreateAccount.js";
import * as Login from "./src/screens/Login.js";
import * as CharacterScreen from "./src/screens/CharacterScreen.js";
import { Midi } from "@tonejs/midi";
import { networkManager } from "./src/NetworkManager.js";
import { registerNetworkHandlers } from "./src/handlers/index.js";
import { showInitMessage } from "./src/handlers/init.js";
import { MapCache } from "./src/utils/MapCache.js";
import { buildMapCanvas } from "./src/utils/MapRenderHelper.js";
import { buildPixiMapView } from "./src/utils/PixiMapRenderer.js";

const backgroundImagePath = "./sprites/bg.png";
const buttonSpritePath = "./sprites/gfx001/113.png";
const USE_PIXI_MAP_RENDERER = false;

// ── Audio ─────────────────────────────────────────────────────────────────────

let audioCtx = null;
let masterGain = null;
let activeMfxOscillators = [];
let activeMfxGains = [];
let activeMfxLoopTimer = null;

function ensureAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
}

export function PlaySFX(id, type) {
    ensureAudioContext();
    const prefix = type === "G" ? "gui" : type === "H" ? "har" : "sfx";
    const paddedId = String(id).padStart(3, "0");
    const audio = new Audio(`./audio/sfx/${prefix}${paddedId}.wav`);
    audio.play().catch((err) => console.error(`PlaySFX(${id}, ${type}) failed:`, err));
}

export function PlayMFX(id, { loop = false } = {}) {
    ensureAudioContext();

    // Stop any currently playing MFX.
    activeMfxOscillators.forEach((o) => { try { o.stop(); } catch (_) {} });
    activeMfxGains.forEach((g) => { try { g.disconnect(); } catch (_) {} });
    activeMfxOscillators = [];
    activeMfxGains = [];
    if (activeMfxLoopTimer) { clearTimeout(activeMfxLoopTimer); activeMfxLoopTimer = null; }

    fetch(`./audio/mfx/${id}.mid`)
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.arrayBuffer();
        })
        .then((buffer) => {
            const midi = new Midi(buffer);
            const notes = midi.tracks.flatMap((t) => t.notes);
            if (!notes.length) { console.warn(`PlayMFX(${id}): no notes`); return; }

            const startAt = audioCtx.currentTime + 0.04;
            const songDuration = Math.max(...notes.map((n) => n.time + n.duration));

            notes.forEach((note) => {
                const osc = audioCtx.createOscillator();
                osc.type = "triangle";
                osc.frequency.value = note.frequency;

                const gain = audioCtx.createGain();
                const vel = Number.isFinite(note.velocity) ? note.velocity : 0.8;
                gain.gain.setValueAtTime(0, startAt + note.time);
                gain.gain.linearRampToValueAtTime(Math.max(0.05, vel), startAt + note.time + 0.01);
                gain.gain.linearRampToValueAtTime(0, startAt + note.time + Math.max(0.04, note.duration));

                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(startAt + note.time);
                osc.stop(startAt + note.time + Math.max(0.05, note.duration));

                activeMfxOscillators.push(osc);
                activeMfxGains.push(gain);
            });

            if (loop) {
                activeMfxLoopTimer = setTimeout(
                    () => PlayMFX(id, { loop: true }),
                    Math.ceil(songDuration * 1000),
                );
            }
        })
        .catch((err) => console.error(`PlayMFX(${id}) failed:`, err));
}

// ── Images ────────────────────────────────────────────────────────────────────

function preloadImage(path, onLoad = () => {}) {
    const image = new Image();
    image.src = path;
    image.onload = () => { onLoad(path); };
    image.onerror = () => { console.error(`Failed to load image: ${path}`); };
}

preloadImage(backgroundImagePath, (path) => {
    document.body.style.backgroundImage = `url(${path})`;
});

preloadImage(buttonSpritePath);

// ── Menu ──────────────────────────────────────────────────────────────────────

const menu = document.querySelector(".menu");
registerNetworkHandlers(networkManager);
const mapCache = new MapCache();
let activeCharacter = null;
let activeMapData = null;
let activeMapRenderToken = 0;
let resizeRerenderTimer = null;
let fpsRafId = null;
let fpsFrameCount = 0;
let fpsWindowStart = 0;

function getCharacterMapId(character) {
    if (!character) return 0;
    if (typeof character.getMapId === "function") return Number(character.getMapId()) || 0;
    return Number(character.mapId) || 0;
}

function getCharacterMapX(character) {
    if (!character) return 0;
    if (typeof character.getMapX === "function") return Number(character.getMapX()) || 0;
    return Number(character.mapX) || 0;
}

function getCharacterMapY(character) {
    if (!character) return 0;
    if (typeof character.getMapY === "function") return Number(character.getMapY()) || 0;
    return Number(character.mapY) || 0;
}

function getCharacterGender(character) {
    if (!character) return 0;
    if (typeof character.getGender === "function") return Number(character.getGender()) || 0;
    return Number(character.gender) || 0;
}

function getCharacterSkin(character) {
    if (!character) return 0;
    if (typeof character.getSkin === "function") return Number(character.getSkin()) || 0;
    return Number(character.skin) || 0;
}

function getCharacterDirection(character) {
    if (!character) return 0;
    if (typeof character.getDirection === "function") return Number(character.getDirection()) || 0;
    return Number(character.direction) || 0;
}

function setCharacterDirection(character, direction) {
    if (!character) {
        return;
    }

    if (typeof character.setDirection === "function") {
        character.setDirection(direction);
        return;
    }

    character.direction = direction;
}

function getDirectionFromArrowKey(key) {
    switch (key) {
    case "ArrowDown":
        return 0;
    case "ArrowLeft":
        return 1;
    case "ArrowUp":
        return 2;
    case "ArrowRight":
        return 3;
    default:
        return null;
    }
}

function isTypingTarget(target) {
    if (!target || !(target instanceof HTMLElement)) {
        return false;
    }

    return (
        target.isContentEditable
        || target.tagName === "INPUT"
        || target.tagName === "TEXTAREA"
        || target.tagName === "SELECT"
    );
}

function getCharacterHairStyle(character) {
    if (!character) return 1;
    if (typeof character.getHairStyle === "function") return Number(character.getHairStyle()) || 1;
    return Number(character.hairStyle) || 1;
}

function getCharacterHairColour(character) {
    if (!character) return 0;
    if (typeof character.getHairColour === "function") return Number(character.getHairColour()) || 0;
    return Number(character.hairColour) || 0;
}

function disposeWorldView(node) {
    if (node && typeof node.__disposeWorldView === "function") {
        node.__disposeWorldView();
    }
}

function stopWorldFpsCounter() {
    if (fpsRafId !== null) {
        cancelAnimationFrame(fpsRafId);
        fpsRafId = null;
    }

    const screen = document.querySelector(".world-screen");
    const fpsEl = screen?.querySelector(".world-fps");
    if (fpsEl) {
        fpsEl.textContent = "FPS: --";
    }
}

function startWorldFpsCounter() {
    if (fpsRafId !== null) {
        return;
    }

    const screen = ensureWorldScreen();
    const fpsEl = screen.querySelector(".world-fps");
    if (!fpsEl) {
        return;
    }

    fpsFrameCount = 0;
    fpsWindowStart = performance.now();
    fpsEl.textContent = "FPS: --";

    const tick = (now) => {
        if (screen.style.display === "none") {
            stopWorldFpsCounter();
            return;
        }

        fpsFrameCount += 1;
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 500) {
            const fps = Math.round((fpsFrameCount * 1000) / elapsed);
            fpsEl.textContent = `FPS: ${fps}`;
            fpsFrameCount = 0;
            fpsWindowStart = now;
        }

        fpsRafId = requestAnimationFrame(tick);
    };

    fpsRafId = requestAnimationFrame(tick);
}

function ensureWorldScreen() {
    let screen = document.querySelector(".world-screen");
    if (screen) {
        return screen;
    }

    screen = document.createElement("div");
    screen.className = "world-screen";

    const hud = document.createElement("div");
    hud.className = "world-hud";

    const title = document.createElement("div");
    title.className = "world-map-title";
    title.textContent = "Map";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "world-back-btn";
    backBtn.textContent = "Back";
    backBtn.addEventListener("click", () => {
        screen.style.display = "none";
        stopWorldFpsCounter();
        const charScreen = document.querySelector(".char-screen");
        if (charScreen) {
            charScreen.style.display = "";
        } else {
            menu.style.display = "";
        }
    });

    hud.appendChild(title);
    hud.appendChild(backBtn);

    const mapWrap = document.createElement("div");
    mapWrap.className = "world-map-wrap";

    const fpsCounter = document.createElement("div");
    fpsCounter.className = "world-fps";
    fpsCounter.textContent = "FPS: --";

    screen.appendChild(fpsCounter);
    screen.appendChild(hud);
    screen.appendChild(mapWrap);
    document.body.appendChild(screen);

    return screen;
}

function showWorldLoading(character) {
    const screen = ensureWorldScreen();
    const mapWrap = screen.querySelector(".world-map-wrap");
    const mapTitle = screen.querySelector(".world-map-title");

    mapTitle.textContent = `Loading map ${getCharacterMapId(character)} for ${character.name}...`;
    mapWrap.textContent = "Requesting map data from server...";

    const charScreen = document.querySelector(".char-screen");
    if (charScreen) {
        charScreen.style.display = "none";
    }

    screen.style.display = "flex";
}

async function renderCharacterMap(character, mapData) {
    const renderToken = ++activeMapRenderToken;
    const screen = ensureWorldScreen();
    const mapWrap = screen.querySelector(".world-map-wrap");
    const mapTitle = screen.querySelector(".world-map-title");
    const mapWrapRect = mapWrap.getBoundingClientRect();
    const viewportWidth = Math.max(1, Math.floor(mapWrapRect.width || window.innerWidth));
    const viewportHeight = Math.max(1, Math.floor(mapWrapRect.height || window.innerHeight));

    mapTitle.textContent = `${character.name} - Map ${mapData.id} (${mapData.width}x${mapData.height})`;
    disposeWorldView(mapWrap.firstElementChild);
    mapWrap.innerHTML = "";
    mapWrap.textContent = "Rendering map...";

    const view = USE_PIXI_MAP_RENDERER
        ? await buildPixiMapView(mapData, {
            playerX: getCharacterMapX(character),
            playerY: getCharacterMapY(character),
            playerGender: getCharacterGender(character),
            playerSkin: getCharacterSkin(character),
            playerDirection: getCharacterDirection(character),
            playerHairStyle: getCharacterHairStyle(character),
            playerHairColour: getCharacterHairColour(character),
            viewportWidth,
            viewportHeight,
            viewportZoom: 0,
        })
        : await buildMapCanvas(mapData, {
        playerX: getCharacterMapX(character),
        playerY: getCharacterMapY(character),
        playerGender: getCharacterGender(character),
        playerSkin: getCharacterSkin(character),
        playerDirection: getCharacterDirection(character),
        playerHairStyle: getCharacterHairStyle(character),
        playerHairColour: getCharacterHairColour(character),
        viewportWidth,
        viewportHeight,
        viewportZoom: 0,
    });

    if (renderToken !== activeMapRenderToken) {
        return;
    }

    if (!view) {
        mapWrap.textContent = "Map data is invalid and could not be rendered.";
        screen.style.display = "flex";
        startWorldFpsCounter();
        return;
    }

    activeMapData = mapData;
    if (view instanceof HTMLCanvasElement) {
        view.className = "world-map-canvas";
    }
    mapWrap.innerHTML = "";
    mapWrap.appendChild(view);
    screen.style.display = "flex";
    startWorldFpsCounter();
}

async function rerenderActiveMapToCurrentViewport() {
    const screen = document.querySelector(".world-screen");
    if (!screen || screen.style.display === "none" || !activeCharacter || !activeMapData) {
        return;
    }

    await renderCharacterMap(activeCharacter, activeMapData);
}

async function updateActiveMapPlayerOnly() {
    const screen = document.querySelector(".world-screen");
    if (!screen || screen.style.display === "none" || !activeCharacter) {
        return false;
    }

    const mapWrap = screen.querySelector(".world-map-wrap");
    const currentView = mapWrap?.firstElementChild;
    const updatePlayer = currentView?.__updateWorldViewPlayer;
    if (typeof updatePlayer !== "function") {
        return false;
    }

    await updatePlayer({
        playerX: getCharacterMapX(activeCharacter),
        playerY: getCharacterMapY(activeCharacter),
        playerGender: getCharacterGender(activeCharacter),
        playerSkin: getCharacterSkin(activeCharacter),
        playerDirection: getCharacterDirection(activeCharacter),
        playerHairStyle: getCharacterHairStyle(activeCharacter),
        playerHairColour: getCharacterHairColour(activeCharacter),
    });

    return true;
}

async function ensureCharacterMap(character) {
    const mapId = getCharacterMapId(character);
    if (mapId <= 0) {
        showInitMessage("Character has no valid map id.", "Map Error");
        return;
    }

    activeCharacter = character;

    if (mapCache.has(mapId)) {
        await renderCharacterMap(character, mapCache.get(mapId));
        return;
    }

    showWorldLoading(character);

    if (mapCache.isPending(mapId)) {
        return;
    }

    mapCache.markPending(mapId);
    const sent = networkManager.requestMap(mapId);
    if (!sent) {
        mapCache.clearPending(mapId);
        showInitMessage("Failed to request map data from server.", "Map Error");
    }
}

document.addEventListener("network:init", (event) => {
    const { status, connectionType } = event.detail;
    console.log(`[Network] INIT response status: ${status}`);

    if (status === 1) {
        if (connectionType === 0) {
            CreateAccount.show(menu);
        } else if (connectionType === 1) {
            Login.show(menu);
        }
        return;
    }

    if (status === 5) {
        console.warn("[Network] Client version mismatch - update required");
        return;
    }

    console.error("[Network] Connection failed");
});

document.addEventListener("network:login-reply", async (event) => {
    const { success, characters } = event.detail;

    if (!success) {
        showInitMessage("Login failed. Please check your account details.", "Login Failed");
        return;
    }

    const loginForm = document.querySelector(".ca-form");
    if (loginForm) loginForm.remove();

    await CharacterScreen.show(menu, characters);
});

document.addEventListener("ui:message", (event) => {
    const { title = "Notice", message = "" } = event.detail ?? {};
    if (!message) {
        return;
    }

    showInitMessage(message, title);
});

document.addEventListener("network:account-reply", (event) => {
    const { success, message } = event.detail;

    showInitMessage(message, "Server Response");

    if (!success) {
        return;
    }

    const form = document.querySelector(".ca-form");
    if (form) {
        form.remove();
    }
    menu.style.display = "";
});

document.addEventListener("ui:character-login", async (event) => {
    const character = event.detail?.character;
    if (!character) {
        return;
    }

    await ensureCharacterMap(character);
});

document.addEventListener("network:map-reply", async (event) => {
    const { success, maps } = event.detail;

    if (!success) {
        if (activeCharacter) {
            showInitMessage("Server returned map request failure.", "Map Error");
        }
        return;
    }

    mapCache.storeMany(maps);

    if (!activeCharacter) {
        return;
    }

    const activeMapId = getCharacterMapId(activeCharacter);
    const mapData = mapCache.get(activeMapId);
    if (!mapData) {
        return;
    }

    await renderCharacterMap(activeCharacter, mapData);
});

window.addEventListener("pointerdown", () => ensureAudioContext(), { once: true });
window.addEventListener("keydown",     () => ensureAudioContext(), { once: true });

window.addEventListener("keydown", (event) => {
    if (event.repeat) {
        return;
    }

    if (isTypingTarget(event.target)) {
        return;
    }

    const worldScreen = document.querySelector(".world-screen");
    if (!worldScreen || worldScreen.style.display === "none") {
        return;
    }

    if (!activeCharacter) {
        return;
    }

    const nextDirection = getDirectionFromArrowKey(event.key);
    if (nextDirection === null) {
        return;
    }

    const currentDirection = getCharacterDirection(activeCharacter);
    if (currentDirection === nextDirection) {
        return;
    }

    event.preventDefault();
    setCharacterDirection(activeCharacter, nextDirection);

    updateActiveMapPlayerOnly()
        .then((updated) => {
            if (!updated) {
                return rerenderActiveMapToCurrentViewport();
            }
            return null;
        })
        .catch((err) => {
            console.error("Failed to update map after direction change:", err);
        });
});

window.addEventListener("resize", () => {
    if (resizeRerenderTimer) {
        clearTimeout(resizeRerenderTimer);
    }

    resizeRerenderTimer = setTimeout(() => {
        resizeRerenderTimer = null;
        rerenderActiveMapToCurrentViewport().catch((err) => {
            console.error("Failed to rerender map on resize:", err);
        });
    }, 120);
});

document.querySelector(".btn-create-account").addEventListener("click", async () => {
    const success = await networkManager.initiateAccountCreation();
    if (!success) {
        console.error("Failed to connect to server");
    }
});

document.querySelector(".btn-play-game").addEventListener("click", async () => {
    const success = await networkManager.initiateLogin();
    if (!success) {
        console.error("Failed to connect to server");
    }
});

