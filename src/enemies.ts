import { GAME_WIDTH, GAME_HEIGHT } from './main';

// Enemy types and their properties
export enum EnemyType {
    BASIC = 'basic',
    FAST = 'fast',
    TANK = 'tank'
}

export class Enemy {
    public id: string;
    public type: EnemyType;
    public x: number;
    public y: number;
    public health: number;
    public maxHealth: number;
    public speed: number;
    public damage: number;
    public size: number;
    public color: string;
    public pathProgress: number;
    public nearbyEnemies: Enemy[];

    constructor(type: EnemyType, x: number, y: number, config: typeof ENEMY_CONFIGS[EnemyType], id?: string) {
        this.id = id || Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.x = x;
        this.y = y;
        this.health = config.health;
        this.maxHealth = config.health;
        this.speed = config.speed;
        this.damage = config.damage;
        this.size = config.size;
        this.color = config.color;
        this.pathProgress = 0;
        this.nearbyEnemies = [];
    }

    public takeDamage(amount: number) {
        this.health = Math.max(0, this.health - amount);
    }

    public toNetworkData() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            health: this.health,
            pathProgress: this.pathProgress
        };
    }
}

// Enemy configurations
const ENEMY_CONFIGS = {
    [EnemyType.BASIC]: {
        health: 100,  // Reduced from 200 to 100
        speed: 0.5,  // Reduced speed for path following
        damage: 10,
        size: 20,
        color: 'red'
    },
    [EnemyType.FAST]: {
        health: 75,  // Reduced from 150 to 75
        speed: 1,    // Faster path following
        damage: 5,
        size: 15,
        color: 'yellow'
    },
    [EnemyType.TANK]: {
        health: 250,  // Reduced from 500 to 250
        speed: 0.25, // Slower path following
        damage: 20,
        size: 30,
        color: 'purple'
    }
};

// Round configuration
interface RoundConfig {
    enemyCount: number;
    enemyTypes: EnemyType[];
    spawnInterval: number;
}

// Round progression
const ROUND_CONFIGS: RoundConfig[] = [
    // Round 1: Basic enemies only
    {
        enemyCount: 5,
        enemyTypes: [EnemyType.BASIC],
        spawnInterval: 2000
    },
    // Round 2: Basic and Fast enemies
    {
        enemyCount: 8,
        enemyTypes: [EnemyType.BASIC, EnemyType.FAST],
        spawnInterval: 1800
    },
    // Round 3: All enemy types
    {
        enemyCount: 12,
        enemyTypes: [EnemyType.BASIC, EnemyType.FAST, EnemyType.TANK],
        spawnInterval: 1500
    }
];

// Define the path points
const PATH_POINTS = [
    { x: 0, y: 0.5 },           // Start at left middle
    { x: 0.3, y: 0.5 },         // Move right
    { x: 0.3, y: 0.2 },         // Move up
    { x: 0.7, y: 0.2 },         // Move right
    { x: 0.7, y: 0.8 },         // Move down
    { x: 1.2, y: 0.8 }          // End at right side (extended further beyond screen edge)
];

export class EnemyManager {
    private currentRound: number = 0;
    private enemies: Enemy[] = [];
    private spawnTimer: number | null = null;
    private enemiesSpawned: number = 0;
    private lives: number = 100;  // Number of lives before game over
    private isRoundActive: boolean = false;
    private isHost: boolean = false;
    private network: any = null;

    constructor() {
        // Don't start round automatically
    }

    public setNetwork(network: any, isHost: boolean) {
        this.network = network;
        this.isHost = isHost;
    }

    public startRound() {
        if (this.isRoundActive) return; // Don't start if round is already active
        
        this.isRoundActive = true;
        this.enemiesSpawned = 0;
        
        // If host, send round start to other player
        if (this.isHost && this.network) {
            this.network.sendRoundStart();
        }
        
        const roundConfig = ROUND_CONFIGS[this.currentRound];
        
        // Start spawning enemies
        this.spawnTimer = window.setInterval(() => {
            if (this.enemiesSpawned < roundConfig.enemyCount) {
                this.spawnEnemy();
                this.enemiesSpawned++;
            } else {
                // Stop spawning but don't end round yet
                if (this.spawnTimer) {
                    clearInterval(this.spawnTimer);
                    this.spawnTimer = null;
                }
            }
        }, roundConfig.spawnInterval);
    }

    private prepareNextRound() {
        if (this.currentRound >= ROUND_CONFIGS.length) {
            // Handle game completion or loop back to first round
            this.currentRound = 0;
        }
        this.isRoundActive = false;
    }

    private spawnEnemy() {
        const roundConfig = ROUND_CONFIGS[this.currentRound];
        const enemyType = roundConfig.enemyTypes[Math.floor(Math.random() * roundConfig.enemyTypes.length)];
        const config = ENEMY_CONFIGS[enemyType];

        // Spawn enemy at the start of the path
        const startPoint = PATH_POINTS[0];
        const x = startPoint.x * GAME_WIDTH;
        const y = startPoint.y * GAME_HEIGHT;

        const enemy = new Enemy(enemyType, x, y, config);
        this.enemies.push(enemy);
    }

    private endRound() {
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
        this.currentRound++;
        this.prepareNextRound();
    }

    private getPositionAlongPath(progress: number): { x: number, y: number } {
        // Clamp progress between 0 and 1
        progress = Math.max(0, Math.min(1, progress));
        
        // If at the end, return the last point
        if (progress >= 1) {
            const lastPoint = PATH_POINTS[PATH_POINTS.length - 1];
            return {
                x: lastPoint.x * GAME_WIDTH,
                y: lastPoint.y * GAME_HEIGHT
            };
        }
        
        // Find the segment of the path we're on
        const segmentIndex = Math.floor(progress * (PATH_POINTS.length - 1));
        const segmentProgress = (progress * (PATH_POINTS.length - 1)) % 1;
        
        const start = PATH_POINTS[segmentIndex];
        const end = PATH_POINTS[segmentIndex + 1];
        
        return {
            x: (start.x + (end.x - start.x) * segmentProgress) * GAME_WIDTH,
            y: (start.y + (end.y - start.y) * segmentProgress) * GAME_HEIGHT
        };
    }

    public update() {
        // Update enemies
        this.enemies = this.enemies.filter(enemy => {
            // Remove dead enemies
            if (enemy.health <= 0) {
                return false; // Remove enemy from array
            }

            // Update path progress
            enemy.pathProgress += enemy.speed / 1000; // Adjust speed for path following
            
            // Get new position along path
            const newPos = this.getPositionAlongPath(enemy.pathProgress);
            enemy.x = newPos.x;
            enemy.y = newPos.y;
            
            // Check if enemy reached the end
            if (enemy.pathProgress >= 1) {
                this.enemyReachedEnd(enemy);
                return false; // Remove enemy from array
            }

            return true; // Keep enemy in array
        });

        // Check if round should end (all enemies spawned and no enemies remaining)
        if (this.isRoundActive && this.enemiesSpawned >= ROUND_CONFIGS[this.currentRound].enemyCount && this.enemies.length === 0) {
            this.endRound();
        }

        // If host, sync enemies with other player
        if (this.isHost && this.network) {
            this.network.sendEnemySync(this.enemies.map(enemy => enemy.toNetworkData()));
        }
    }

    public draw(ctx: CanvasRenderingContext2D) {
        // Draw the path
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(PATH_POINTS[0].x * GAME_WIDTH, PATH_POINTS[0].y * GAME_HEIGHT);
        for (let i = 1; i < PATH_POINTS.length; i++) {
            ctx.lineTo(PATH_POINTS[i].x * GAME_WIDTH, PATH_POINTS[i].y * GAME_HEIGHT);
        }
        ctx.stroke();

        // Draw enemies
        this.enemies.forEach(enemy => {
            // Draw enemy
            ctx.fillStyle = enemy.color;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
            ctx.fill();

            // Draw health bar background
            const healthBarWidth = enemy.size * 2;
            const healthBarHeight = 5;
            const healthBarX = enemy.x - healthBarWidth / 2;
            const healthBarY = enemy.y - enemy.size - 10;

            // Background (red)
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

            // Health (green)
            const healthPercentage = enemy.health / enemy.maxHealth;
            ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercentage, healthBarHeight);

            // Health bar border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.strokeRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

            // Draw health text
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(enemy.health)}/${enemy.maxHealth}`, enemy.x, healthBarY - 5);
        });
    }

    public getEnemies(): Enemy[] {
        return this.enemies;
    }

    public getCurrentRound(): number {
        return this.currentRound + 1;
    }

    public getLives(): number {
        return this.lives;
    }

    public isRoundInProgress(): boolean {
        return this.isRoundActive;
    }

    public getRoundConfig(): RoundConfig {
        return ROUND_CONFIGS[this.currentRound];
    }

    public resetLives() {
        this.lives = 100;
    }

    public resetRound() {
        this.currentRound = 0;
        this.enemies = [];
        if (this.spawnTimer) {
            clearInterval(this.spawnTimer);
            this.spawnTimer = null;
        }
        this.enemiesSpawned = 0;
        this.isRoundActive = false;
    }

    private enemyReachedEnd(enemy: Enemy) {
        // Decrease lives
        this.lives--;
        
        // Check if game over
        if (this.lives <= 0) {
            // Stop spawning new enemies
            if (this.spawnTimer) {
                clearInterval(this.spawnTimer);
                this.spawnTimer = null;
            }
            this.isRoundActive = false;
            return;
        }
    }

    public syncEnemies(enemyData: { id: string, type: string, x: number, y: number, health: number, pathProgress: number }[]) {
        // Update existing enemies and add new ones
        const existingEnemies = new Map(this.enemies.map(e => [e.id, e]));
        
        this.enemies = enemyData.map(data => {
            const existingEnemy = existingEnemies.get(data.id);
            if (existingEnemy) {
                // Update existing enemy
                existingEnemy.x = data.x;
                existingEnemy.y = data.y;
                existingEnemy.health = data.health;
                existingEnemy.pathProgress = data.pathProgress;
                return existingEnemy;
            } else {
                // Create new enemy
                const config = ENEMY_CONFIGS[data.type as EnemyType];
                const enemy = new Enemy(data.type as EnemyType, data.x, data.y, config, data.id);
                enemy.health = data.health;
                enemy.pathProgress = data.pathProgress;
                return enemy;
            }
        });
    }
}

export const enemyManager = new EnemyManager(); 