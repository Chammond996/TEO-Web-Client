/**
 * Manages character sprite sheets and texture extraction.
 * Character sprites are organized in a grid:
 * - 4 columns (directions): DOWN, RIGHT, LEFT, UP
 * - Multiple rows (character variations based on gender/skin)
 */
export class SpriteManager {
    constructor() {
        this.spriteSheets = new Map(); // path -> loaded image
        this.textureCache = new Map(); // key -> canvas
        this.SPRITE_WIDTH = 18;
        this.SPRITE_HEIGHT = 58;
        this.DIRECTIONS = {
            DOWN: 0,
            LEFT: 1,
            UP: 2,
            RIGHT: 3,
        };
    }

    /**
     * Load a sprite sheet image asynchronously
     * @param {string} path - Path to the sprite sheet PNG
     * @returns {Promise<Image>}
     */
    loadSpriteSheet(path) {
        return new Promise((resolve, reject) => {
            if (this.spriteSheets.has(path)) {
                resolve(this.spriteSheets.get(path));
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.spriteSheets.set(path, img);
                resolve(img);
            };
            img.onerror = () => reject(new Error(`Failed to load sprite sheet: ${path}`));
            img.src = path;
        });
    }

    /**
     * Extract a single sprite from a spritesheet
     * @param {string} sheetPath - Path to the sprite sheet
     * @param {number} row - Row index in the grid
    * @param {number} direction - Direction (0=DOWN, 1=LEFT, 2=UP, 3=RIGHT)
     * @returns {Promise<HTMLCanvasElement>}
     */
    async getSprite(sheetPath, row, direction, gender = 0) {
        const cacheKey = `${sheetPath}:${row}:${direction}:${gender}`;
        if (this.textureCache.has(cacheKey)) {
            return this.textureCache.get(cacheKey);
        }

        const sheet = await this.loadSpriteSheet(sheetPath);
        const maxRows = Math.max(1, Math.floor(sheet.height / this.SPRITE_HEIGHT));
        const safeRow = Math.max(0, Math.min(maxRows - 1, row));
        const safeDirection = Number.isFinite(direction) ? direction : this.DIRECTIONS.DOWN;
        const safeGender = Number.isFinite(gender) ? gender : 0;

        // Match requested behavior:
        // RIGHT uses flipped DOWN frame, and UP uses flipped LEFT frame.
        let srcX = (safeDirection === this.DIRECTIONS.LEFT || safeDirection === this.DIRECTIONS.UP)
            ? this.SPRITE_WIDTH
            : 0;
        if (safeGender === 1) {
            srcX += this.SPRITE_WIDTH * 2;
        }
        const flipImage = safeDirection === this.DIRECTIONS.RIGHT || safeDirection === this.DIRECTIONS.UP;
        const srcY = safeRow * this.SPRITE_HEIGHT;

        const canvas = document.createElement("canvas");
        canvas.width = this.SPRITE_WIDTH;
        canvas.height = this.SPRITE_HEIGHT;

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        if (flipImage) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(
                sheet,
                srcX,
                srcY,
                this.SPRITE_WIDTH,
                this.SPRITE_HEIGHT,
                -this.SPRITE_WIDTH,
                0,
                this.SPRITE_WIDTH,
                this.SPRITE_HEIGHT
            );
            ctx.restore();
        } else {
            ctx.drawImage(
                sheet,
                srcX,
                srcY,
                this.SPRITE_WIDTH,
                this.SPRITE_HEIGHT,
                0,
                0,
                this.SPRITE_WIDTH,
                this.SPRITE_HEIGHT
            );
        }

        this.textureCache.set(cacheKey, canvas);
        return canvas;
    }

    /**
     * Get the character sprite sheet path based on appearance
     * Currently returns gfx008/101.png - can be extended for variations
     * @param {number} gender - Character gender
     * @param {number} skin - Character skin tone
     * @returns {string}
     */
    getCharacterSheetPath(gender, skin) {
        // Base sprite sheet - can be extended to use different sheets for different appearances
        return "./sprites/gfx008/101.png";
    }

    /**
     * Build path for a standalone sprite image from gfx folders.
     * Example: gfxFile=9 id=123 -> ./sprites/gfx009/123.png
     * @param {number} gfxFile
     * @param {number} id
     * @returns {string}
     */
    getGfxSpritePath(gfxFile, id) {
        const file = String(gfxFile).padStart(3, "0");
        return `./sprites/gfx${file}/${id}.png`;
    }

    /**
     * Load a standalone sprite image by gfx file and id.
     * @param {number} gfxFile
     * @param {number} id
     * @returns {Promise<Image|null>}
     */
    async getGfxSprite(gfxFile, id) {
        if (!Number.isFinite(id) || id < 1) {
            return null;
        }

        // Some assets are indexed with +100 in extracted PNG sets.
        const candidateIds = [id, id + 100];
        for (const candidateId of candidateIds) {
            const path = this.getGfxSpritePath(gfxFile, candidateId);
            try {
                const image = await this.loadSpriteSheet(path);
                return image;
            } catch (_) {
                // Try next candidate.
            }
        }

        return null;
    }

    /**
     * Determine the row index based on character appearance
     * @param {number} gender - Character gender
     * @param {number} skin - Character skin tone
     * @returns {number}
     */
    getCharacterRow(gender, skin) {
        // Match C++ client: race/skin directly maps to row index.
        const safeSkin = Number.isFinite(skin) ? skin : 0;
        return Math.max(0, Math.min(6, safeSkin));
    }
}

// Export singleton instance
export const spriteManager = new SpriteManager();
