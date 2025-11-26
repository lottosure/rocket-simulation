// Module aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Events = Matter.Events,
    Vector = Matter.Vector,
    Body = Matter.Body;

// Configuration
const config = {
    width: window.innerWidth,
    height: window.innerHeight,
    groundHeight: 60,
    groundWidth: 50000, // Make ground very wide
    cannonPos: { x: 100, y: window.innerHeight - 60 - 20 }, // Ground height 60, cannon radius ~20
    cannonLength: 60,
    pixelsPerMeter: 20 // Scale for distance calculation
};

// State
let engine, render, runner;
let projectiles = [];
let trails = []; // Array of {x, y} arrays

// UI Elements
const angleSlider = document.getElementById('angle-slider');
const powerSlider = document.getElementById('power-slider');
const angleVal = document.getElementById('angle-val');
const powerVal = document.getElementById('power-val');
const btnFire = document.getElementById('btn-fire');
const btnReset = document.getElementById('btn-reset');
const distanceDisplay = document.getElementById('distance-display');
const dataBody = document.getElementById('data-body');
const dragEnabled = document.getElementById('drag-enabled');

let attemptCount = 0;

function init() {
    // Create engine
    engine = Engine.create();
    engine.world.gravity.y = 1; // Standard gravity

    // Create renderer
    render = Render.create({
        element: document.getElementById('canvas-container'),
        engine: engine,
        options: {
            width: config.width,
            height: config.height,
            wireframes: false,
            background: 'transparent', // Allow CSS body background to show through
            pixelRatio: window.devicePixelRatio
        }
    });

    // Create ground
    const ground = Bodies.rectangle(
        config.groundWidth / 2, // Center so it starts at 0 and goes right
        config.height - config.groundHeight / 2,
        config.groundWidth,
        config.groundHeight,
        {
            isStatic: true,
            render: { fillStyle: '#333' },
            label: 'Ground'
        }
    );

    // Add bodies
    Composite.add(engine.world, [ground]);

    // Start simulation
    Render.run(render);
    runner = Runner.create();
    Runner.run(runner, engine);

    // Events
    Events.on(render, 'afterRender', drawOverlay);
    Events.on(engine, 'collisionStart', handleCollision);
    Events.on(engine, 'beforeUpdate', updateTrails);

    // Window resize handling
    window.addEventListener('resize', () => {
        config.width = window.innerWidth;
        config.height = window.innerHeight;

        // Update render bounds
        render.canvas.width = config.width;
        render.canvas.height = config.height;
        render.options.width = config.width;
        render.options.height = config.height;

        // IMPORTANT: Update bounds so we can see the new area
        render.bounds.max.x = config.width;
        render.bounds.max.y = config.height;

        // Reposition Ground
        Body.setPosition(ground, {
            x: config.groundWidth / 2,
            y: config.height - config.groundHeight / 2
        });

        // Update cannon Y position to stay on ground
        config.cannonPos.y = config.height - config.groundHeight - 20;

        // Reset world to prevent physics glitches and invalid distances
        // because the "launch point" has effectively moved relative to existing bodies
        resetWorld();
    });
}

// --- Game Logic ---

function fireProjectile() {
    const angleDeg = parseFloat(angleSlider.value);
    const power = parseFloat(powerSlider.value);
    const angleRad = angleDeg * (Math.PI / 180);

    // Determine drag
    let frictionAir = 0;
    if (dragEnabled.checked) {
        frictionAir = 0.01; // Reduced from 0.2 to 0.01 for realism
    }

    // Calculate spawn position at tip of cannon
    const spawnX = config.cannonPos.x + Math.cos(-angleRad) * config.cannonLength;
    const spawnY = config.cannonPos.y + Math.sin(-angleRad) * config.cannonLength;

    const projectile = Bodies.circle(spawnX, spawnY, 10, {
        restitution: 0.5, // Bounciness
        friction: 0.005,
        frictionAir: frictionAir, // Apply user setting
        density: 0.04,
        render: { fillStyle: dragEnabled.checked ? '#ffaa00' : '#00ff88' }, // Different color for drag
        label: 'Projectile',
        collisionFilter: { group: -1 } // Prevent self-collision
    });

    // Store launch data for logging
    projectile.launchAngle = angleDeg;
    projectile.launchPower = power;
    projectile.launchDrag = frictionAir;

    // Calculate velocity vector
    // Negative Y is up in Canvas
    const velocity = {
        x: Math.cos(-angleRad) * power,
        y: Math.sin(-angleRad) * power
    };

    Body.setVelocity(projectile, velocity);
    Composite.add(engine.world, projectile);

    // Track this projectile
    projectiles.push(projectile);
    trails.push([]); // New trail for this projectile
}

function handleCollision(event) {
    const pairs = event.pairs;

    pairs.forEach(pair => {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Check if Projectile hits Ground
        let projectile = null;
        if (bodyA.label === 'Projectile' && bodyB.label === 'Ground') projectile = bodyA;
        else if (bodyB.label === 'Projectile' && bodyA.label === 'Ground') projectile = bodyB;

        if (projectile && !projectile.hasLanded) {
            // Mark as landed so we don't update distance again for this projectile
            projectile.hasLanded = true;

            // Calculate distance
            // We use the initial x position of the cannon as 0
            const distancePixels = projectile.position.x - config.cannonPos.x;
            const distanceMeters = (distancePixels / config.pixelsPerMeter).toFixed(2);

            // Only update if it's a positive distance and moving forward
            if (distancePixels > 0) {
                distanceDisplay.innerText = distanceMeters;

                // Optional: Stop the ball after a bit or let it roll
                // To freeze it: Body.setStatic(projectile, true);
                // We'll let it roll for realism, but maybe dampen it
                projectile.friction = 0.5;

                // Visual feedback for landing
                projectile.render.fillStyle = '#ff0055'; // Change color on impact

                // Log to table
                logAttempt(projectile.launchAngle, projectile.launchPower, projectile.launchDrag, distanceMeters);
            }
        }
    });
}

function logAttempt(angle, power, drag, distance) {
    attemptCount++;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${attemptCount}</td>
        <td>${angle}°</td>
        <td>${power}</td>
        <td>${drag > 0 ? 'On' : 'Off'}</td>
        <td>${distance}m</td>
    `;
    dataBody.appendChild(row);

    // Auto-scroll the panel
    const panel = document.getElementById('data-panel');
    panel.scrollTop = panel.scrollHeight;
}

function updateTrails() {
    // Update trails for active projectiles
    projectiles.forEach((proj, index) => {
        if (!proj.isStatic && proj.position.y < config.height) {
            // Add current position to trail
            // Limit trail length for performance if needed, but for simple demo it's fine
            if (engine.timing.timestamp % 5 === 0) { // Sample every few frames
                trails[index].push({ ...proj.position });
            }
        }
    });
}

function resetWorld() {
    // Remove all projectiles
    projectiles.forEach(p => Composite.remove(engine.world, p));
    projectiles = [];
    trails = [];
    projectiles = [];
    trails = [];
    distanceDisplay.innerText = "0.0";
    // Optional: Clear table? User might want to keep history. Let's keep it for now.
    dataBody.innerHTML = '';
    attemptCount = 0;
}

// --- Rendering ---

function drawOverlay() {
    const ctx = render.context;
    const angleDeg = parseFloat(angleSlider.value);
    const angleRad = angleDeg * (Math.PI / 180);

    // Draw Cannon
    ctx.save();
    ctx.translate(config.cannonPos.x, config.cannonPos.y);
    ctx.rotate(-angleRad); // Rotate upwards

    // Cannon Barrel
    ctx.fillStyle = '#666';
    ctx.fillRect(0, -10, config.cannonLength, 20);

    // Cannon Base (visual only)
    ctx.restore();
    ctx.beginPath();
    ctx.arc(config.cannonPos.x, config.cannonPos.y, 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#444';
    ctx.fill();

    // Draw Trails
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    trails.forEach(trail => {
        if (trail.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.stroke();
    });
    ctx.restore();
}

// --- Event Listeners ---

angleSlider.addEventListener('input', (e) => {
    angleVal.innerText = e.target.value + '°';
});

powerSlider.addEventListener('input', (e) => {
    powerVal.innerText = e.target.value;
});

dragEnabled.addEventListener('change', (e) => {
    if (e.target.checked) {
        document.body.classList.add('air-mode');
    } else {
        document.body.classList.remove('air-mode');
    }
});

btnFire.addEventListener('click', fireProjectile);
btnReset.addEventListener('click', resetWorld);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') fireProjectile();
    if (e.code === 'KeyR') resetWorld();
});

// Initialize
init();
