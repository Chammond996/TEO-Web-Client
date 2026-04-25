/**
 * Character Render Helper
 * Provides reusable functions for rendering character sprites
 * Used by character selection screen and game world rendering
 */
import { spriteManager } from "./SpriteManager.js";

export class CharacterRenderHelper {
    static COMPOSITE_WIDTH = 50;
    static COMPOSITE_HEIGHT = 100;
    static COMPOSITE_FEET_Y = 78;
    static BODY_OFFSET_X = 20;
    static BODY_OFFSET_Y = 20;
    static BACK_HAIR_OFFSET_X = 14;
    static BACK_HAIR_OFFSET_Y = 10;
    static FRONT_HAIR_OFFSET_X = 15;
    static FRONT_HAIR_OFFSET_Y = 8;

    static drawLayer(ctx, image, x, y, flipX = false) {
        if (!image) {
            return;
        }

        if (flipX) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(image, -x - image.width, y);
            ctx.restore();
            return;
        }

        ctx.drawImage(image, x, y);
    }

    static async buildCharacterComposite(character) {
        const canvas = document.createElement("canvas");
        canvas.width = this.COMPOSITE_WIDTH;
        canvas.height = this.COMPOSITE_HEIGHT;

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const gender = Number.isFinite(character.gender) ? character.gender : 0;
        const skin = Number.isFinite(character.skin) ? character.skin : 0;
        const direction = Number.isFinite(character.direction) ? character.direction : 0;
        const hairStyle = Math.max(1, Number.isFinite(character.hairStyle) ? character.hairStyle : 1);
        const hairColourRaw = Number.isFinite(character.hairColour) ? character.hairColour : 0;
        // C++ logic assumes 1-based hair colour for ID math.
        const hairColour = Math.max(1, hairColourRaw);

        const isRight = direction === 3;
        const isUp = direction === 2;
        const isLeft = direction === 1;
        const flipBackHair = isRight;
        const flipFrontHair = isRight || isUp;

        // Hair file matches C++: female -> 10, male -> 9.
        const hairFile = gender === 0 ? 10 : 9;

        // Back hair only on DOWN/RIGHT.
        if (!isLeft && !isUp) {
            const backHairId = ((hairStyle - 1) * 40) + (hairColour * 4) - 3;
            const backHair = await spriteManager.getGfxSprite(hairFile, backHairId);
            this.drawLayer(
                ctx,
                backHair,
                this.BACK_HAIR_OFFSET_X,
                this.BACK_HAIR_OFFSET_Y,
                flipBackHair
            );
        }

        // Body layer.
        const spriteSheet = spriteManager.getCharacterSheetPath(gender, skin);
        const row = spriteManager.getCharacterRow(gender, skin);
        const body = await spriteManager.getSprite(spriteSheet, row, direction, gender);
        this.drawLayer(ctx, body, this.BODY_OFFSET_X, this.BODY_OFFSET_Y, false);

        // Front hair always attempted.
        let frontHairId = ((hairStyle - 1) * 40) + (hairColour * 4) - 2;
        if (isLeft || isUp) {
            frontHairId += 2;
        }
        const frontHair = await spriteManager.getGfxSprite(hairFile, frontHairId);
        this.drawLayer(
            ctx,
            frontHair,
            this.FRONT_HAIR_OFFSET_X,
            this.FRONT_HAIR_OFFSET_Y,
            flipFrontHair
        );

        return canvas;
    }

    /**
     * Render a character sprite onto a canvas at the specified position
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw on
     * @param {Character} character - Character object to render
     * @param {number} x - X position to render at
     * @param {number} y - Y position to render at
     * @param {number} scale - Scale factor (default 2)
     */
    static async renderCharacterSprite(ctx, character, x, y, scale = 2, options = {}) {
        const { anchor = "top-left" } = options;
        try {
            const spriteCanvas = await this.buildCharacterComposite(character);

            ctx.imageSmoothingEnabled = false;

            const drawWidth = spriteCanvas.width * scale;
            const drawHeight = spriteCanvas.height * scale;
            // Keep x aligned to body origin (legacy behavior) even though body is offset inside composite.
            const drawX = x - (this.BODY_OFFSET_X * scale);
            const drawY = anchor === "feet"
                ? (y - (this.COMPOSITE_FEET_Y * scale))
                : y;

            ctx.drawImage(
                spriteCanvas,
                drawX,
                drawY,
                drawWidth,
                drawHeight
            );
        } catch (error) {
            console.error(`Failed to render character ${character.name}:`, error);
            // Render error placeholder
            ctx.fillStyle = "#FF0000";
            ctx.font = "12px Arial";
            ctx.fillText("Render Error", x, y);
        }
    }

    /**
     * Create and populate a character preview canvas
     * Used for character selection screen
     * @param {Character} character - Character to render
     * @param {number} width - Canvas width (default 200)
     * @param {number} height - Canvas height (default 180)
     * @param {number} spriteX - X position to render sprite (default 45)
     * @param {number} spriteY - Y position to render sprite (default 100)
     * @returns {Promise<HTMLCanvasElement>}
     */
    static async createCharacterPreview(character, width = 200, height = 180, spriteX = 45, spriteY = 100) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        // Keep preview transparent so the panel art shows through and equipment layers can extend naturally.
        ctx.clearRect(0, 0, width, height);

        await this.renderCharacterSprite(ctx, character, spriteX, spriteY, 2, { anchor: "feet" });

        return canvas;
    }

    /**
     * Render multiple characters to a single canvas
     * Used for game world rendering
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Character[]} characters - Characters to render
     * @param {number} scale - Scale factor (default 2)
     */
    static async renderCharacters(ctx, characters, scale = 2) {
        for (const character of characters) {
            if (!character.position) {
                console.warn(`Character ${character.name} has no position`);
                continue;
            }
            await this.renderCharacterSprite(
                ctx,
                character,
                character.position.x,
                character.position.y,
                scale
            );
        }
    }

    /**
     * Update character direction and render
     * Handles changing which way the character faces
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Character} character - Character to update and render
     * @param {number} direction - New direction (0=DOWN, 1=RIGHT, 2=LEFT, 3=UP)
     * @param {number} x - X position to render at
     * @param {number} y - Y position to render at
     * @param {number} scale - Scale factor (default 2)
     */
    static async setDirectionAndRender(ctx, character, direction, x, y, scale = 2) {
        character.direction = direction;
        await this.renderCharacterSprite(ctx, character, x, y, scale);
    }

    /**
     * Create a character canvas suitable for game world rendering
     * @param {number} width - Canvas width (default 800)
     * @param {number} height - Canvas height (default 600)
     * @returns {HTMLCanvasElement}
     */
    static createGameCanvas(width = 800, height = 600) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.style.border = "1px solid #333";
        return canvas;
    }

    /**
     * Start a character render loop for animation/game world
     * @param {HTMLCanvasElement} canvas - Canvas to render to
     * @param {Character[]} characters - Characters to render
     * @param {Function} updateFn - Update function called each frame (receives deltaTime)
     * @param {number} fps - Target frames per second (default 60)
     * @returns {Function} - Call to stop the loop
     */
    static startRenderLoop(canvas, characters, updateFn = null, fps = 60) {
        const ctx = canvas.getContext("2d");
        const frameDuration = 1000 / fps;
        let lastFrameTime = 0;
        let animationId = null;

        const loop = async (currentTime) => {
            if (currentTime - lastFrameTime >= frameDuration) {
                // Clear canvas
                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Update game state
                if (updateFn) {
                    updateFn(currentTime - lastFrameTime);
                }

                // Render characters
                await this.renderCharacters(ctx, characters, 2);

                lastFrameTime = currentTime;
            }

            animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);

        // Return function to stop the loop
        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }
}
