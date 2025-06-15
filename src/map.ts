// Tile types
export const TILE_TYPES = {
    EMPTY: 0,
    ENEMY_PATH: 1,
    TOWER_TILE: 2
} as const;

export type TileType = typeof TILE_TYPES[keyof typeof TILE_TYPES];

// Tile colors
export const TILE_COLORS: Record<TileType, string> = {
    [TILE_TYPES.EMPTY]: '#2c3e50',      // Dark blue-gray
    [TILE_TYPES.ENEMY_PATH]: '#e74c3c', // Red
    [TILE_TYPES.TOWER_TILE]: '#27ae60'  // Green
};

// Grid constants
export const TILE_SIZE = 50;
export const PADDING = 50;
let gridVisible = false;  // Grid is hidden by default

// Define the map grid
export let mapGrid: TileType[][] = [];

// Function to initialize map grid
export function initializeMapGrid(canvas: HTMLCanvasElement) {
    const { width, height } = getGridDimensions(canvas);
    mapGrid = Array(height).fill(0).map(() => Array(width).fill(TILE_TYPES.EMPTY));
}

// Example path for enemies (you can modify this to create different paths)
function createEnemyPath(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const { width } = getGridDimensions(canvas);
    for (let y = 7; y < 8; y++) {
        for (let x = 0; x < width; x++) {
            mapGrid[y][x] = TILE_TYPES.ENEMY_PATH;
        }
    }
}

// Example tower placement tiles
function createTowerTiles(): void {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const { width } = getGridDimensions(canvas);
    for (let y = 5; y < 10; y++) {
        for (let x = 2; x < width - 2; x++) {
            if (mapGrid[y][x] === TILE_TYPES.EMPTY) {
                mapGrid[y][x] = TILE_TYPES.TOWER_TILE;
            }
        }
    }
}

// Initialize the map
createEnemyPath();
createTowerTiles();

// Function to draw the grid
export function drawGrid(ctx: CanvasRenderingContext2D): void {
    if (!gridVisible) return;  // Don't draw if grid is hidden

    const canvas = ctx.canvas;
    
    // Calculate scale to maintain aspect ratio
    const scale = window.innerHeight / 1080;
    const GAME_WIDTH = window.innerWidth / scale;
    
    // Calculate columns and rows to fill game world
    const cols = Math.floor(GAME_WIDTH / TILE_SIZE);
    const rows = Math.floor(1080 / TILE_SIZE);
    
    // Calculate actual grid dimensions
    const gridWidth = cols * TILE_SIZE;
    const gridHeight = rows * TILE_SIZE;
    
    // Calculate centered offsets
    const offsetX = (GAME_WIDTH - gridWidth) / 2;
    const offsetY = (1080 - gridHeight) / 2;

    // Set grid line style
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;

    // Save current transform
    ctx.save();
    
    // Apply the same scale transform as the game
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Draw grid cells
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = offsetX + col * TILE_SIZE;
            const y = offsetY + row * TILE_SIZE;
            ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
        }
    }

    // Restore transform
    ctx.restore();
}

// Function to toggle grid visibility
export function toggleGrid(): void {
    gridVisible = !gridVisible;
}

// Function to check if grid is visible
export function isGridVisible(): boolean {
    return gridVisible;
}

// Function to resize canvas and redraw
export function resizeCanvas(canvas: HTMLCanvasElement): void {
    // Set canvas to fill window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Reinitialize map grid with new dimensions
    initializeMapGrid(canvas);
}

// Add window resize handler
window.addEventListener('resize', () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
        resizeCanvas(canvas);
    }
});

// Function to get grid dimensions
export function getGridDimensions(canvas: HTMLCanvasElement) {
    const gridSize = calculateGridSize(canvas);
    // Calculate dimensions that will give us whole cells
    const width = Math.floor(canvas.width / gridSize);
    const height = Math.floor(canvas.height / gridSize);
    return {
        width,
        height,
        cellSize: gridSize
    };
}

// Calculate grid size to ensure perfect squares that align with screen edges
export function calculateGridSize(canvas: HTMLCanvasElement): number {
    const width = canvas.width;
    const height = canvas.height;
    // Target number of cells (aim for around 50px per cell)
    const targetCells = Math.min(
        Math.floor(width / 50),
        Math.floor(height / 50)
    );
    
    // Calculate cell size that will fit perfectly
    const cellSize = Math.floor(Math.min(width, height) / targetCells);
    
    // Ensure we have whole number of cells
    const numCellsWidth = Math.floor(width / cellSize);
    const numCellsHeight = Math.floor(height / cellSize);
    
    // Return the size that gives us whole cells
    return Math.min(
        Math.floor(width / numCellsWidth),
        Math.floor(height / numCellsHeight)
    );
} 