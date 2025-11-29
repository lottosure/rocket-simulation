
const angles = [35, 40, 45, 50, 55];
const power = 10;
const results = {};

function runTest() {
    console.log("Starting Range Test...");

    // Mocking the environment if needed, or we can just run this in the browser console manually.
    // But since I am an agent, I will simulate the physics calculation directly to verify the math.

    const gravity = 1; // From script.js engine.world.gravity.y = 1
    // Matter.js default gravity scale is 0.001. 
    // engine.world.gravity.scale = 0.001 by default.
    // So actual gravity is 1 * 0.001 per step^2? No, let's check the code.

    // In script.js: engine.world.gravity.y = 1;
    // We need to check if scale is modified. It's not in the snippet.

    // Let's just use the browser to run the actual code.
    // I'll create a small test function to inject into script.js or just run via console.
}

// Actually, I'll just modify script.js to log the exact launch coordinates and landing coordinates.
// This will help me see the height difference.
console.log("Config Cannon Pos Y:", config.cannonPos.y);
console.log("Ground Y:", config.height - config.groundHeight);
