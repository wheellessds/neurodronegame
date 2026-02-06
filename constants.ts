
export const GRAVITY = 0.25;
export const DRAG = 0.985;
export const ANGULAR_DRAG = 0.75;
export const ROTATION_SPEED = 0.30;

// Neuro Mode Constants
export const NEURO_THRUST = 0.6;
export const NEURO_FUEL_CONSUMPTION = 0.65;
export const NEURO_LAG_CHANCE = 0.002;

// Evil Mode Constants
export const EVIL_THRUST = 0.95;
export const EVIL_FUEL_CONSUMPTION = 1.2;

// Rope/Cable Physics
export const ROPE_LENGTH = 60;
export const ROPE_K = 0.8;
export const ROPE_DAMPING = 0.8;

export const DAMAGE_THRESHOLD = 3.5;
export const COLLISION_BOUNCE = -0.4;

export const INITIAL_MONEY = 100;

// Tutel Swarm Constants
export const TUTEL_AGGRO_RANGE = 350;
export const TUTEL_SPEED = 2.0;
export const TUTEL_WEIGHT_PENALTY = 0.02;
export const TUTEL_DRAG_PENALTY = 0.01;
export const SHAKE_OFF_THRESHOLD = 0.15;

// Copium Gas Constants
export const GAS_GRAVITY_FLIP_INTERVAL = 120;

// Endless Mode Constants
export const CHUNK_SIZE = 1200; // How wide each generated section is
export const CHECKPOINT_INTERVAL = 3000; // Distance between shops
export const RENDER_DISTANCE = 3000; // How far ahead to generate
export const PRUNE_DISTANCE = 2000; // How far behind to delete

// High Speed Effects Constants
export const HIGH_SPEED_THRESHOLD = 15; // Measured in physics speed (UI speed = speed * 10)
export const HIGH_SPEED_DELAY = 60; // Frames (approx 1s at 60fps) to start
export const HIGH_SPEED_COOLDOWN = 12; // Frames (approx 0.2s at 60fps) to stop
