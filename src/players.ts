export interface PlayerStats {
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
}

export class Player {
    public hasValidPosition = false;
    private stats: PlayerStats;
    private id: string;
    public x: number = 0;
    public y: number = 0;
    public targetX: number = 0;
    public targetY: number = 0;
    public name: string = '';
    public shipType: string = 'ship1';
    public angle: number = 0;

    constructor(id: string) {
        this.id = id;
        this.stats = {
            health: 100,
            maxHealth: 100,
            shield: 50,
            maxShield: 50
        };
        console.log('Created new player with id:', id);
    }

    public updatePosition(x: number, y: number, angle: number): void {
        this.targetX = x;
        this.targetY = y;
        this.angle = angle;

        if (!this.hasValidPosition && (x !== 0 || y !== 0)) {
            this.hasValidPosition = true;
        }
    }

    public update(): void {
        // Smoothly interpolate current position to target
        if (this.hasValidPosition) {
            this.x += (this.targetX - this.x) * 0.2;
            this.y += (this.targetY - this.y) * 0.2;
        }
    }

    public updateShipType(shipType: string): void {
        console.log(`Updating ship type for ${this.id}:`, shipType);
        this.shipType = shipType;
    }

    public updateStats(newStats: Partial<PlayerStats>): void {
        this.stats = { ...this.stats, ...newStats };
    }

    public getStats(): PlayerStats {
        return this.stats;
    }
} 