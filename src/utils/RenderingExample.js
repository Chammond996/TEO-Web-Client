/**
 * Example: Character Rendering Integration
 * 
 * This shows how to use the CharacterRenderer with your characters.
 * Place this in your main game loop or use it as a reference.
 */

import { CharacterRenderer } from "./utils/CharacterRenderer.js";
import { Character } from "./Character.js";

/**
 * Initialize character rendering on a canvas
 * @param {HTMLCanvasElement} canvas - The canvas to render to
 * @param {Character[]} characters - Array of Character objects
 */
export function initializeCharacterRendering(canvas, characters) {
    // Set up default positions for characters (example: arrange in a grid)
    characters.forEach((char, index) => {
        char.setPosition(100 + index * 150, 200);
    });

    // Start the render loop
    const stopRender = CharacterRenderer.startRenderLoop(
        canvas,
        characters,
        (deltaTime) => {
            // Update game logic here
            // This function is called before each render
            updateCharacterAnimations(characters, deltaTime);
        },
        60 // 60 FPS
    );

    return stopRender;
}

/**
 * Example: Update character animations
 * This is where you update character state/frame for animation
 * @param {Character[]} characters - Characters to update
 * @param {number} deltaTime - Time since last frame
 */
function updateCharacterAnimations(characters, deltaTime) {
    for (const character of characters) {
        // Example: Advance animation frame
        if (character.getState() === "walk") {
            // Increment frame and loop
            character.setFrame((character.getFrame() + 1) % 4); // Assuming 4 walk frames
        }

        // Example: Handle idle state
        if (character.getState() === "idle") {
            // Could add idle animation here
            character.setFrame(0);
        }
    }
}

/**
 * Example: Handle direction changes
 * Call this when a character needs to face a different direction
 * @param {Character} character - Character to update
 * @param {number} direction - Direction index (0=DOWN, 1=RIGHT, 2=LEFT, 3=UP)
 */
export function setCharacterDirection(character, direction) {
    character.direction = direction;
}

/**
 * Example: Handle character movement
 * @param {Character} character - Character to move
 * @param {number} targetX - Target X position
 * @param {number} targetY - Target Y position
 */
export function moveCharacter(character, targetX, targetY) {
    character.setMoving(true); // This sets state to "walk"
    character.setPosition(targetX, targetY);

    // After movement is complete:
    // character.setMoving(false); // This sets state back to "idle"
}
