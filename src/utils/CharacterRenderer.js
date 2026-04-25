/**
 * Character Renderer - Handles all character sprite rendering
 * Implements the "dumb and fast" rendering pattern:
 * - Character object holds state (position, direction, animation frame)
 * - Renderer simply applies the current state to draw the character
 * - No decision logic - all logic is in game code
 */
import { spriteManager } from "./SpriteManager.js";

export class CharacterRenderer {
    /**
     * Render a single character to the given canvas context
     * @param {CanvasRenderingContext2D} ctx - Canvas context to draw on
     * @param {Character} character - Character object to render
     * @param {HTMLCanvasElement} spriteCanvas - The sprite canvas to draw
     * @param {number} scale - Scale factor for rendering (default 2)
     */
    static async renderCharacter(ctx, character, spriteCanvas, scale = 2) {
        if (!character || !spriteCanvas) return;

        const x = character.position?.x || 0;
        const y = character.position?.y || 0;

        // Draw the sprite at the character's position with scaling
        ctx.drawImage(
            spriteCanvas,
            x,
            y,
            spriteCanvas.width * scale,
            spriteCanvas.height * scale
        );

        // Optional: Draw debug info
        if (character.showDebugInfo) {
            ctx.fillStyle = "#FFF";
            ctx.font = "12px Arial";
            ctx.fillText(character.name, x, y - 10);
        }
    }

    /**
     * Update and render multiple characters
     * Call this from your game loop
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {Character[]} characters - Array of characters to render
     * @param {number} scale - Scale factor
     */
    static async renderCharacters(ctx, characters, scale = 2) {
        for (const character of characters) {
            // Get the appropriate sprite based on current direction
            const spriteSheet = spriteManager.getCharacterSheetPath(
                character.gender,
                character.skin
            );
            const row = spriteManager.getCharacterRow(character.gender, character.skin);

            try {
                const spriteCanvas = await spriteManager.getSprite(
                    spriteSheet,
                    row,
                    character.direction
                );
                await this.renderCharacter(ctx, character, spriteCanvas, scale);
            } catch (error) {
                console.error(`Failed to render character ${character.name}:`, error);
            }
        }
    }

    /**
     * Create a canvas for rendering characters
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {string} containerId - ID of container element (optional)
     * @returns {HTMLCanvasElement}
     */
    static createCanvas(width = 800, height = 600, containerId = null) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.style.border = "1px solid #ccc";

        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.appendChild(canvas);
            } else {
                console.warn(`Container with ID ${containerId} not found`);
            }
        }

        return canvas;
    }

    /**
     * Start a render loop for continuous animation
     * @param {HTMLCanvasElement} canvas - Canvas to render to
     * @param {Character[]} characters - Characters to render
     * @param {Function} update - Update function called each frame
     * @param {number} fps - Target frames per second
     * @returns {Function} - Call to stop the render loop
     */
    static startRenderLoop(canvas, characters, update, fps = 60) {
        const ctx = canvas.getContext("2d");
        const frameDuration = 1000 / fps;
        let lastFrameTime = 0;

        const animate = async (currentTime) => {
            if (currentTime - lastFrameTime >= frameDuration) {
                // Clear canvas
                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Update game state
                if (update) {
                    update(currentTime);
                }

                // Render characters
                await this.renderCharacters(ctx, characters, 2);

                lastFrameTime = currentTime;
            }

            requestAnimationFrame(animate);
        };

        const stopLoop = () => cancelAnimationFrame(animationId);
        const animationId = requestAnimationFrame(animate);

        return stopLoop;
    }
}
