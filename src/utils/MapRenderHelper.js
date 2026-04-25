import { spriteManager } from "./SpriteManager.js";
import { CharacterRenderHelper } from "./CharacterRenderHelper.js";

const HALF_TILE_WIDTH = 32;
const HALF_TILE_HEIGHT = 16;
const TILE_WIDTH = HALF_TILE_WIDTH * 2;
const TILE_HEIGHT = HALF_TILE_HEIGHT * 2;
const VIEWPORT_TILES_WIDE = 20;
const VIEWPORT_TILES_TALL = 15;
const DEFAULT_VIEWPORT_WIDTH = VIEWPORT_TILES_WIDE * TILE_WIDTH;
const DEFAULT_VIEWPORT_HEIGHT = VIEWPORT_TILES_TALL * TILE_HEIGHT;
const MAP_EDGE_TILE_SPEC = 19;
const TILE_DEPTH_GAP = 0.00000001;
const ROW_DEPTH_GAP = 0.001;
const LAYER_DEPTH = [
    -3.0 + TILE_DEPTH_GAP * 1,
    0.0 + TILE_DEPTH_GAP * 4,
    0.0 + TILE_DEPTH_GAP * 7,
    0.0 + TILE_DEPTH_GAP * 8,
    -ROW_DEPTH_GAP + TILE_DEPTH_GAP * 9,
    0.0 + TILE_DEPTH_GAP * 10,
    0.0 + TILE_DEPTH_GAP * 1,
    -1.0 + TILE_DEPTH_GAP * 1,
    1.0 + TILE_DEPTH_GAP * 1,
];
const RENDER_LAYERS = [
    {
        index: 0,
        gfxFileId: 3,
        useFillTile: true,
        emptyValues: new Set([1, 100]),
        kind: "ground",
    },
    {
        index: 1,
        gfxFileId: 4,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "object",
    },
    {
        index: 2,
        gfxFileId: 5,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "overlay",
    },
    {
        index: 3,
        gfxFileId: 6,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "down-wall",
    },
    {
        index: 4,
        gfxFileId: 6,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "right-wall",
    },
    {
        index: 5,
        gfxFileId: 7,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "roof",
    },
    {
        index: 6,
        gfxFileId: 3,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "top",
    },
    {
        index: 7,
        gfxFileId: 22,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "shadow",
    },
    {
        index: 8,
        gfxFileId: 5,
        useFillTile: false,
        emptyValues: new Set([1]),
        kind: "overlay2",
    },
];

const imageCache = new Map();

function isoToScreen(tileX, tileY) {
    return {
        x: (tileX - tileY) * HALF_TILE_WIDTH,
        y: (tileX + tileY) * HALF_TILE_HEIGHT,
    };
}

function getViewportSpec(availableWidth, availableHeight) {
    const safeAvailableWidth = Math.max(1, Math.floor(Number(availableWidth) || DEFAULT_VIEWPORT_WIDTH));
    const safeAvailableHeight = Math.max(1, Math.floor(Number(availableHeight) || DEFAULT_VIEWPORT_HEIGHT));

    return {
        zoom: 0,
        logicalWidth: safeAvailableWidth,
        logicalHeight: safeAvailableHeight,
    };
}

function buildPresentationCanvas(sourceCanvas) {
    sourceCanvas.style.width = `${sourceCanvas.width}px`;
    sourceCanvas.style.height = `${sourceCanvas.height}px`;
    sourceCanvas.style.imageRendering = "pixelated";
    return sourceCanvas;
}

function calculateDepth(layerIndex, tileX, tileY) {
    return LAYER_DEPTH[layerIndex] + tileY * ROW_DEPTH_GAP + tileX * RENDER_LAYERS.length * TILE_DEPTH_GAP;
}

function getLayerOffset(kind, width, height) {
    if (kind === "shadow") {
        return { x: -24, y: -12 };
    }

    if (kind === "object" || kind === "overlay" || kind === "overlay2") {
        return {
            x: -2 - width / 2 + HALF_TILE_WIDTH,
            y: -2 - height + TILE_HEIGHT,
        };
    }

    if (kind === "down-wall") {
        return { x: -32 + HALF_TILE_WIDTH, y: -1 - (height - TILE_HEIGHT) };
    }

    if (kind === "right-wall") {
        return { x: HALF_TILE_WIDTH, y: -1 - (height - TILE_HEIGHT) };
    }

    if (kind === "roof") {
        return { x: 0, y: -TILE_WIDTH };
    }

    if (kind === "top") {
        return { x: 0, y: -TILE_HEIGHT };
    }

    return { x: 0, y: 0 };
}

function resolveLayerTileId(layerConfig, rawTileId, fillTileId) {
    let tileId = Number(rawTileId);

    if (layerConfig.useFillTile && (tileId === 0 || tileId === 1)) {
        tileId = Number(fillTileId) + 100;
    }

    if (!Number.isFinite(tileId) || tileId <= 0) {
        return null;
    }

    if (layerConfig.emptyValues.has(tileId)) {
        return null;
    }

    return tileId;
}

async function loadPlayerStandingSprite(options = {}) {
    return CharacterRenderHelper.buildCharacterComposite({
        gender: Number(options.playerGender ?? 0),
        skin: Number(options.playerSkin ?? 0),
        direction: Number(options.playerDirection ?? 0),
        hairStyle: Number(options.playerHairStyle ?? 1),
        hairColour: Number(options.playerHairColour ?? 0),
    });
}

async function loadTileForLayer(gfxFileId, tileId) {
    if (!Number.isFinite(tileId) || tileId <= 0) {
        return null;
    }

    const cacheKey = `${gfxFileId}:tile:${tileId}`;
    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
    }

    const pending = (async () => {
        // Match fixed layer->gfx-pack rendering.
        // Keep same-pack fallbacks only to tolerate PNG exports that shifted ids by 100.
        const candidates = [tileId, tileId - 100, tileId + 100];
        for (const candidateId of candidates) {
            if (!Number.isFinite(candidateId) || candidateId <= 0) {
                continue;
            }

            // Explicitly skip gfx003/100 cushion for ground rendering.
            if (gfxFileId === 3 && candidateId === 100) {
                continue;
            }

            const path = spriteManager.getGfxSpritePath(gfxFileId, candidateId);
            try {
                const image = await spriteManager.loadSpriteSheet(path);
                if (image) {
                    return image;
                }
            } catch (_) {
                // Try next candidate.
            }
        }

        return null;
    })();

    imageCache.set(cacheKey, pending);
    return pending;
}

async function buildStaticEntities(layers, fillTile, tileSpecs, width, height) {
    const entities = [];

    for (const layerConfig of RENDER_LAYERS) {
        const layerTiles = Array.isArray(layers[layerConfig.index]) ? layers[layerConfig.index] : [];

        for (let tileY = 0; tileY < height; tileY++) {
            for (let tileX = 0; tileX < width; tileX++) {
                const index = tileY * width + tileX;
                if (Number(tileSpecs[index] ?? -1) === MAP_EDGE_TILE_SPEC) {
                    continue;
                }

                const tileId = resolveLayerTileId(layerConfig, Number(layerTiles[index] ?? 0), fillTile);
                if (!tileId) {
                    continue;
                }

                const image = await loadTileForLayer(layerConfig.gfxFileId, tileId);
                if (!image) {
                    continue;
                }

                entities.push({
                    tileX,
                    tileY,
                    image,
                    layerKind: layerConfig.kind,
                    depth: calculateDepth(layerConfig.index, tileX, tileY),
                });
            }
        }
    }

    entities.sort((left, right) => left.depth - right.depth);
    return entities;
}

export async function buildMapCanvas(mapData, options = {}) {
    const width = Number(mapData?.width ?? 0);
    const height = Number(mapData?.height ?? 0);
    if (width <= 0 || height <= 0) {
        return null;
    }

    const layers = Array.isArray(mapData.layers) ? mapData.layers : [];
    const fillTile = Number(mapData?.fillTile ?? 0);
    const tileSpecs = Array.isArray(mapData?.tileSpecs) ? mapData.tileSpecs : [];

    const viewportSpec = getViewportSpec(options.viewportWidth, options.viewportHeight);
    const viewportWidth = viewportSpec.logicalWidth;
    const viewportHeight = viewportSpec.logicalHeight;

    const staticCanvas = document.createElement("canvas");
    staticCanvas.width = viewportWidth;
    staticCanvas.height = viewportHeight;
    const staticCtx = staticCanvas.getContext("2d");
    if (!staticCtx) {
        return null;
    }

    staticCtx.imageSmoothingEnabled = false;
    staticCtx.setTransform(2, 0, 0, 2, 0, 0);
    staticCtx.clearRect(0, 0, viewportWidth, viewportHeight);

    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = viewportWidth;
    renderCanvas.height = viewportHeight;

    const ctx = renderCanvas.getContext("2d");
    if (!ctx) {
        return null;
    }

    ctx.imageSmoothingEnabled = false;

    const playerX = Number(options.playerX ?? 0);
    const playerY = Number(options.playerY ?? 0);
    const focusX = playerX > 0 ? playerX - 1 : Math.floor(width / 2);
    const focusY = playerY > 0 ? playerY - 1 : Math.floor(height / 2);
    const playerScreen = isoToScreen(focusX, focusY);
    const staticEntities = await buildStaticEntities(layers, fillTile, tileSpecs, width, height);

    for (const entity of staticEntities) {
        const tileScreen = isoToScreen(entity.tileX, entity.tileY);
        const offset = getLayerOffset(entity.layerKind, entity.image.width, entity.image.height);
        const drawX = Math.floor(
            tileScreen.x
            - HALF_TILE_WIDTH
            - playerScreen.x
            + Math.floor(viewportWidth / 4)
            + offset.x,
        );
        const drawY = Math.floor(
            tileScreen.y
            - HALF_TILE_HEIGHT
            - playerScreen.y
            + Math.floor(viewportHeight / 4)
            + offset.y,
        );

        staticCtx.globalAlpha = entity.layerKind === "shadow" ? 0.2 : 1;
        staticCtx.drawImage(entity.image, drawX, drawY);
    }

    staticCtx.globalAlpha = 1;

    let currentPlayerOptions = {
        playerX: Number(options.playerX ?? 0),
        playerY: Number(options.playerY ?? 0),
        playerGender: Number(options.playerGender ?? 0),
        playerSkin: Number(options.playerSkin ?? 0),
        playerDirection: Number(options.playerDirection ?? 0),
        playerHairStyle: Number(options.playerHairStyle ?? 1),
        playerHairColour: Number(options.playerHairColour ?? 0),
    };
    let playerRenderToken = 0;

    async function redrawWithPlayer(playerOptions) {
        const renderToken = ++playerRenderToken;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, viewportWidth, viewportHeight);
        ctx.drawImage(staticCanvas, 0, 0);

        if (playerOptions.playerX > 0 && playerOptions.playerY > 0) {
            const centerX = Math.floor(viewportWidth / 4);
            const centerY = Math.floor(viewportHeight / 4);

            try {
                const playerSprite = await loadPlayerStandingSprite(playerOptions);
                if (!playerSprite || renderToken !== playerRenderToken) {
                    return;
                }

                const spriteX = Math.floor(centerX - playerSprite.width / 2);
                const spriteY = Math.floor(centerY + HALF_TILE_HEIGHT - playerSprite.height);

                ctx.setTransform(2, 0, 0, 2, 0, 0);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(playerSprite, spriteX, spriteY);
            } catch (_) {
                // Keep map rendering resilient if character sprite fails to load.
            }
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    renderCanvas.__updateWorldViewPlayer = async (nextOptions = {}) => {
        currentPlayerOptions = {
            ...currentPlayerOptions,
            ...nextOptions,
        };
        await redrawWithPlayer(currentPlayerOptions);
    };

    await redrawWithPlayer(currentPlayerOptions);

    return buildPresentationCanvas(renderCanvas);
}
