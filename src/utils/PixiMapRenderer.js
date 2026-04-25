import {
    Application,
    Assets,
    Container,
    SCALE_MODES,
    Sprite,
    Texture,
} from "pixi.js";
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
        this.playerContainer = null;
        this.effectsContainer = null;
        this.uiContainer = null;
        this.textureCache = new Map();
        this.playerTextureCache = new Map();
        this.playerSprite = null;
        this.playerDirection = null;
        this.playerAppearanceKey = null;
        this.baseFocusScreen = { x: 0, y: 0 };
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
            this.playerContainer = new Container();
            this.effectsContainer = new Container();
            this.uiContainer = new Container();

            this.worldContainer.sortableChildren = true;
            this.playerContainer.sortableChildren = true;
            this.effectsContainer.sortableChildren = true;
            this.uiContainer.sortableChildren = true;

            this.app.stage.addChild(this.worldContainer);
            this.app.stage.addChild(this.playerContainer);
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
        if (!this.worldContainer || !this.effectsContainer || !this.uiContainer) {
            return;
        }

        this.worldContainer.removeChildren();
        this.effectsContainer.removeChildren();
        this.uiContainer.removeChildren();
    }

    buildPlayerAppearanceKey(options = {}) {
        const gender = Number(options.playerGender ?? 0);
        const skin = Number(options.playerSkin ?? 0);
        const hairStyle = Number(options.playerHairStyle ?? 1);
        const hairColour = Number(options.playerHairColour ?? 0);
        return `${gender}:${skin}:${hairStyle}:${hairColour}`;
    }

    async getPlayerTextures(options = {}) {
        const appearanceKey = this.buildPlayerAppearanceKey(options);
        if (this.playerTextureCache.has(appearanceKey)) {
            return this.playerTextureCache.get(appearanceKey);
        }

        const pending = (async () => {
            const directionTextures = new Map();
            const base = {
                gender: Number(options.playerGender ?? 0),
                skin: Number(options.playerSkin ?? 0),
                hairStyle: Number(options.playerHairStyle ?? 1),
                hairColour: Number(options.playerHairColour ?? 0),
            };

            // Preload all standing directions once so direction swaps are instant.
            for (const direction of [0, 1, 2, 3]) {
                const canvas = await CharacterRenderHelper.buildCharacterComposite({
                    ...base,
                    direction,
                });
                const texture = Texture.from(canvas);
                if (texture?.source) {
                    texture.source.scaleMode = SCALE_MODES.NEAREST;
                }
                directionTextures.set(direction, texture);
            }

            return directionTextures;
        })();

        this.playerTextureCache.set(appearanceKey, pending);
        return pending;
    }

    ensurePlayerSprite(initialTexture) {
        if (this.playerSprite) {
            return this.playerSprite;
        }

        this.playerSprite = new Sprite(initialTexture);
        this.playerSprite.zIndex = 0;
        this.playerContainer.addChild(this.playerSprite);
        return this.playerSprite;
    }

    positionPlayerSprite() {
        if (!this.playerSprite || !this.app) {
            return;
        }

        const halfWidth = Math.floor(this.app.renderer.width / 2);
        const halfHeight = Math.floor(this.app.renderer.height / 2);

        this.playerSprite.x = Math.floor(halfWidth - this.playerSprite.texture.width / 2);
        this.playerSprite.y = Math.floor(halfHeight + HALF_TILE_HEIGHT - this.playerSprite.texture.height);
    }

    getFocusScreen(playerX, playerY, mapWidth, mapHeight) {
        const focusX = playerX > 0 ? playerX - 1 : Math.floor(mapWidth / 2);
        const focusY = playerY > 0 ? playerY - 1 : Math.floor(mapHeight / 2);
        return isoToScreen(focusX, focusY);
    }

    updateCameraForFocus(focusScreen) {
        const offsetX = Math.floor(this.baseFocusScreen.x - focusScreen.x);
        const offsetY = Math.floor(this.baseFocusScreen.y - focusScreen.y);
        this.worldContainer.position.set(offsetX, offsetY);
        this.effectsContainer.position.set(offsetX, offsetY);
        this.uiContainer.position.set(offsetX, offsetY);
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
        const playerScreen = this.getFocusScreen(playerX, playerY, width, height);
        this.baseFocusScreen = playerScreen;
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

        await this.updatePlayer({
            ...options,
            mapWidth: width,
            mapHeight: height,
        });
        this.updateCameraForFocus(playerScreen);

        this.app.stage.scale.set(2);
        this.app.stage.pivot.set(halfWidth, halfHeight);
        this.app.stage.position.set(halfWidth, halfHeight);

        this.app.renderer.canvas.style.width = `${viewport.width}px`;
        this.app.renderer.canvas.style.height = `${viewport.height}px`;
    }

    async updatePlayer(options = {}) {
        if (!this.app || !this.playerContainer) {
            return;
        }

        const mapWidth = Number(options.mapWidth ?? 0);
        const mapHeight = Number(options.mapHeight ?? 0);
        const playerDirection = Number(options.playerDirection ?? 0);
        const playerX = Number(options.playerX ?? 0);
        const playerY = Number(options.playerY ?? 0);
        const appearanceKey = this.buildPlayerAppearanceKey(options);
        const directionTextures = await this.getPlayerTextures(options);
        const nextTexture = directionTextures.get(playerDirection) ?? directionTextures.get(0);
        if (!nextTexture) {
            return;
        }

        const sprite = this.ensurePlayerSprite(nextTexture);

        // Direction updates only swap texture; the sprite instance remains stable.
        if (this.playerDirection !== playerDirection || this.playerAppearanceKey !== appearanceKey) {
            sprite.texture = nextTexture;
            this.playerDirection = playerDirection;
            this.playerAppearanceKey = appearanceKey;
            this.positionPlayerSprite();
        }

        if (mapWidth > 0 && mapHeight > 0) {
            const focusScreen = this.getFocusScreen(playerX, playerY, mapWidth, mapHeight);
            this.updateCameraForFocus(focusScreen);
        }
    }

    destroy() {
        if (this.app) {
            this.app.destroy(true, { children: true });
            this.app = null;
        }
        this.textureCache.clear();
        this.playerTextureCache.clear();
        this.playerSprite = null;
        this.playerDirection = null;
        this.playerAppearanceKey = null;
        this.hostElement.innerHTML = "";
    }
}

export async function buildPixiMapView(mapData, options = {}) {
    const host = document.createElement("div");
    host.className = "world-map-pixi";
    const renderer = new PixiMapRenderer(host);
    await renderer.renderMap(mapData, options);
    host.__updateWorldViewPlayer = async (nextOptions = {}) => {
        await renderer.updatePlayer({
            ...options,
            ...nextOptions,
            mapWidth: Number(mapData?.width ?? 0),
            mapHeight: Number(mapData?.height ?? 0),
        });
    };
    host.__disposeWorldView = () => renderer.destroy();
    return host;
}