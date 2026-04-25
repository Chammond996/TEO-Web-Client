import {
    Application,
    Assets,
    Container,
    SCALE_MODES,
    Sprite,
} from "pixi.js";

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
    { index: 0, gfxFileId: 3, useFillTile: true, emptyValues: new Set([1, 100]), kind: "ground" },
    { index: 1, gfxFileId: 4, useFillTile: false, emptyValues: new Set([1]), kind: "object" },
    { index: 2, gfxFileId: 5, useFillTile: false, emptyValues: new Set([1]), kind: "overlay" },
    { index: 3, gfxFileId: 6, useFillTile: false, emptyValues: new Set([1]), kind: "down-wall" },
    { index: 4, gfxFileId: 6, useFillTile: false, emptyValues: new Set([1]), kind: "right-wall" },
    { index: 5, gfxFileId: 7, useFillTile: false, emptyValues: new Set([1]), kind: "roof" },
    { index: 6, gfxFileId: 3, useFillTile: false, emptyValues: new Set([1]), kind: "top" },
    { index: 7, gfxFileId: 22, useFillTile: false, emptyValues: new Set([1]), kind: "shadow" },
    { index: 8, gfxFileId: 5, useFillTile: false, emptyValues: new Set([1]), kind: "overlay2" },
];

function isoToScreen(tileX, tileY) {
    return {
        x: (tileX - tileY) * HALF_TILE_WIDTH,
        y: (tileX + tileY) * HALF_TILE_HEIGHT,
    };
}

function getViewportSize(availableWidth, availableHeight) {
    const safeAvailableWidth = Math.max(1, Math.floor(Number(availableWidth) || DEFAULT_VIEWPORT_WIDTH));
    const safeAvailableHeight = Math.max(1, Math.floor(Number(availableHeight) || DEFAULT_VIEWPORT_HEIGHT));

    return {
        zoom: 0,
        width: safeAvailableWidth,
        height: safeAvailableHeight,
    };
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

export class PixiMapRenderer {
    constructor(hostElement) {
        this.hostElement = hostElement;
        this.app = null;
        this.worldContainer = null;
        this.entityContainer = null;
        this.effectsContainer = null;
        this.uiContainer = null;
        this.textureCache = new Map();
    }

    async ensureApp(viewportWidth, viewportHeight) {
        if (!this.app) {
            this.app = new Application();
            await this.app.init({
                width: viewportWidth,
                height: viewportHeight,
                background: "#000000",
                antialias: false,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
            });

            this.app.renderer.canvas.className = "world-map-pixi-canvas";
            this.app.renderer.canvas.style.imageRendering = "pixelated";

            this.worldContainer = new Container();
            this.entityContainer = new Container();
            this.effectsContainer = new Container();
            this.uiContainer = new Container();

            this.worldContainer.sortableChildren = true;
            this.entityContainer.sortableChildren = true;
            this.effectsContainer.sortableChildren = true;
            this.uiContainer.sortableChildren = true;

            this.app.stage.addChild(this.worldContainer);
            this.app.stage.addChild(this.entityContainer);
            this.app.stage.addChild(this.effectsContainer);
            this.app.stage.addChild(this.uiContainer);

            this.hostElement.innerHTML = "";
            this.hostElement.appendChild(this.app.renderer.canvas);
        } else {
            this.app.renderer.resize(viewportWidth, viewportHeight);
        }

        this.app.renderer.canvas.style.width = `${viewportWidth}px`;
        this.app.renderer.canvas.style.height = `${viewportHeight}px`;
    }

    async getTextureForLayer(gfxFileId, tileId) {
        if (!Number.isFinite(tileId) || tileId <= 0) {
            return null;
        }

        const cacheKey = `${gfxFileId}:${tileId}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey);
        }

        const pending = (async () => {
            const candidates = [tileId, tileId - 100, tileId + 100];
            for (const candidateId of candidates) {
                if (!Number.isFinite(candidateId) || candidateId <= 0) {
                    continue;
                }

                if (gfxFileId === 3 && candidateId === 100) {
                    continue;
                }

                const path = `./sprites/gfx${String(gfxFileId).padStart(3, "0")}/${candidateId}.png`;
                try {
                    const texture = await Assets.load(path);
                    texture.source.scaleMode = SCALE_MODES.NEAREST;
                    return texture;
                } catch (_) {
                    // Try next candidate.
                }
            }

            return null;
        })();

        this.textureCache.set(cacheKey, pending);
        return pending;
    }

    clearWorld() {
        if (!this.worldContainer || !this.entityContainer || !this.effectsContainer || !this.uiContainer) {
            return;
        }

        this.worldContainer.removeChildren();
        this.entityContainer.removeChildren();
        this.effectsContainer.removeChildren();
        this.uiContainer.removeChildren();
    }

    async buildStaticEntities(mapData) {
        const width = Number(mapData?.width ?? 0);
        const height = Number(mapData?.height ?? 0);
        const layers = Array.isArray(mapData?.layers) ? mapData.layers : [];
        const fillTile = Number(mapData?.fillTile ?? 0);
        const tileSpecs = Array.isArray(mapData?.tileSpecs) ? mapData.tileSpecs : [];
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

                    const texture = await this.getTextureForLayer(layerConfig.gfxFileId, tileId);
                    if (!texture) {
                        continue;
                    }

                    entities.push({
                        tileX,
                        tileY,
                        texture,
                        layerKind: layerConfig.kind,
                        depth: calculateDepth(layerConfig.index, tileX, tileY),
                    });
                }
            }
        }

        entities.sort((left, right) => left.depth - right.depth);
        return entities;
    }

    async renderMap(mapData, options = {}) {
        const viewport = getViewportSize(options.viewportWidth, options.viewportHeight, options);
        await this.ensureApp(viewport.width, viewport.height);
        this.clearWorld();

        const width = Number(mapData?.width ?? 0);
        const height = Number(mapData?.height ?? 0);
        const playerX = Number(options.playerX ?? 0);
        const playerY = Number(options.playerY ?? 0);
        const focusX = playerX > 0 ? playerX - 1 : Math.floor(width / 2);
        const focusY = playerY > 0 ? playerY - 1 : Math.floor(height / 2);
        const playerScreen = isoToScreen(focusX, focusY);
        const halfWidth = Math.floor(viewport.width / 2);
        const halfHeight = Math.floor(viewport.height / 2);
        const staticEntities = await this.buildStaticEntities(mapData);

        for (const entity of staticEntities) {
            const tileScreen = isoToScreen(entity.tileX, entity.tileY);
            const offset = getLayerOffset(
                entity.layerKind,
                entity.texture.width,
                entity.texture.height,
            );
            const sprite = new Sprite(entity.texture);
            sprite.x = Math.floor(tileScreen.x - HALF_TILE_WIDTH - playerScreen.x + halfWidth + offset.x);
            sprite.y = Math.floor(tileScreen.y - HALF_TILE_HEIGHT - playerScreen.y + halfHeight + offset.y);
            sprite.zIndex = entity.depth;
            if (entity.layerKind === "shadow") {
                sprite.alpha = 0.2;
            }
            this.worldContainer.addChild(sprite);
        }

        this.app.stage.scale.set(2);
        this.app.stage.pivot.set(halfWidth, halfHeight);
        this.app.stage.position.set(halfWidth, halfHeight);

        this.app.renderer.canvas.style.width = `${viewport.width}px`;
        this.app.renderer.canvas.style.height = `${viewport.height}px`;
    }

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true });
            this.app = null;
        }
        this.textureCache.clear();
        this.hostElement.innerHTML = "";
    }
}

export async function buildPixiMapView(mapData, options = {}) {
    const host = document.createElement("div");
    host.className = "world-map-pixi";
    const renderer = new PixiMapRenderer(host);
    await renderer.renderMap(mapData, options);
    host.__disposeWorldView = () => renderer.destroy();
    return host;
}