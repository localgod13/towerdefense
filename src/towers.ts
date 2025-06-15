import { Enemy } from './enemies';

interface Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    type: 'basic' | 'sniper' | 'splash';
    targetId?: string;
    range?: number;
}

export interface Tower {
    id: string;
    x: number;
    y: number;
    range: number;
    damage: number;
    attackSpeed: number;
    lastAttackTime: number;
    cost: number;
    type: 'basic' | 'sniper' | 'splash';
    level: number;
    attackCooldown: number;
}

export class TowerManager {
    private towers: Tower[] = [];
    private projectiles: Projectile[] = [];
    private selectedTowerType: 'basic' | 'sniper' | 'splash' | null = null;
    private isPlacingTower: boolean = false;
    private placementPreview: { x: number; y: number; range: number } | null = null;

    public readonly towerTypes: {
        [key in Tower['type']]: {
            range: number;
            damage: number;
            attackSpeed: number;
            cost: number;
            color: string;
        }
    };

    constructor() {
        // Initialize tower types
        this.towerTypes = {
            basic: {
                range: 150,
                damage: 10,
                attackSpeed: 1000, // ms between attacks
                cost: 100,
                color: '#4CAF50'
            },
            sniper: {
                range: 300,
                damage: 50,
                attackSpeed: 2000,
                cost: 200,
                color: '#2196F3'
            },
            splash: {
                range: 100,
                damage: 15,
                attackSpeed: 1500,
                cost: 150,
                color: '#FF9800'
            }
        };
    }

    public update(enemies: Enemy[]) {
        const now = Date.now();

        // Update towers
        for (const tower of this.towers) {
            // Check if tower can attack
            if (now - tower.lastAttackTime >= tower.attackCooldown) {
                // Find closest enemy in range
                const target = this.findTarget(tower, enemies);
                if (target) {
                    // Create projectile
                    const angle = Math.atan2(target.y - tower.y, target.x - tower.x);
                    const projectile: Projectile = {
                        x: tower.x,
                        y: tower.y,
                        vx: Math.cos(angle) * 5,
                        vy: Math.sin(angle) * 5,
                        damage: tower.damage,
                        type: tower.type,
                        targetId: target.id
                    };
                    this.projectiles.push(projectile);
                    tower.lastAttackTime = now;
                }
            }
        }

        // Update projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            projectile.x += projectile.vx;
            projectile.y += projectile.vy;

            // Check for hits
            const hitEnemy = enemies.find(enemy => 
                enemy.id === projectile.targetId &&
                Math.abs(enemy.x - projectile.x) < 20 &&
                Math.abs(enemy.y - projectile.y) < 20
            );

            if (hitEnemy) {
                hitEnemy.health -= projectile.damage;
                this.projectiles.splice(i, 1);
            } else if (
                projectile.x < 0 || projectile.x > window.innerWidth ||
                projectile.y < 0 || projectile.y > window.innerHeight
            ) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    private findTarget(tower: Tower, enemies: Enemy[]): Enemy | null {
        let closestEnemy: Enemy | null = null;
        let closestDistance = Infinity;

        for (const enemy of enemies) {
            const dx = enemy.x - tower.x;
            const dy = enemy.y - tower.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= tower.range && distance < closestDistance) {
                closestEnemy = enemy;
                closestDistance = distance;
            }
        }

        return closestEnemy;
    }

    public isPlacing(): boolean {
        return this.isPlacingTower;
    }

    public getSelectedTowerType(): 'basic' | 'sniper' | 'splash' | null {
        return this.selectedTowerType;
    }

    public startTowerPlacement(type: 'basic' | 'sniper' | 'splash') {
        this.selectedTowerType = type;
        this.isPlacingTower = true;
    }

    public updatePlacementPreview(x: number, y: number) {
        if (this.isPlacingTower && this.selectedTowerType) {
            this.placementPreview = { x, y, range: this.towerTypes[this.selectedTowerType].range };
        }
    }

    public placeTower(x: number, y: number): { id: string, x: number, y: number, type: 'basic' | 'sniper' | 'splash' } | null {
        if (!this.selectedTowerType) return null;
        
        if (this.isValidPlacement(x, y)) {
            const towerType = this.towerTypes[this.selectedTowerType];
            const tower: Tower = {
                id: Math.random().toString(36).substr(2, 9),
                x,
                y,
                range: towerType.range,
                damage: towerType.damage,
                attackSpeed: towerType.attackSpeed,
                lastAttackTime: 0,
                cost: towerType.cost,
                type: this.selectedTowerType,
                level: 1,
                attackCooldown: 1000
            };
            this.towers.push(tower);
            this.isPlacingTower = false;
            this.selectedTowerType = null;
            this.placementPreview = null;
            return {
                id: tower.id,
                x: tower.x,
                y: tower.y,
                type: tower.type
            };
        }
        return null;
    }

    private isValidPlacement(x: number, y: number): boolean {
        // Check if position is on path (you'll need to implement this)
        // For now, just check if position is not on another tower
        return !this.towers.some(tower => 
            Math.abs(tower.x - x) < 40 && Math.abs(tower.y - y) < 40
        );
    }

    public getTowerCost(type: 'basic' | 'sniper' | 'splash'): number {
        return this.towerTypes[type].cost;
    }

    public draw(ctx: CanvasRenderingContext2D) {
        // Draw towers
        for (const tower of this.towers) {
            // Draw tower base
            ctx.fillStyle = this.towerTypes[tower.type].color;
            ctx.beginPath();
            ctx.arc(tower.x, tower.y, 20, 0, Math.PI * 2);
            ctx.fill();

            // Draw tower level indicator
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tower.level.toString(), tower.x, tower.y);

            // Draw range indicator
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw projectiles
        for (const projectile of this.projectiles) {
            ctx.fillStyle = this.towerTypes[projectile.type].color;
            ctx.beginPath();
            ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw placement preview if placing a tower
        if (this.isPlacingTower && this.placementPreview) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(this.placementPreview.x, this.placementPreview.y, 20, 0, Math.PI * 2);
            ctx.fill();

            // Draw range preview
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(this.placementPreview.x, this.placementPreview.y, this.placementPreview.range, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    public addRemoteTower(tower: { id: string, x: number, y: number, type: 'basic' | 'sniper' | 'splash' }) {
        console.log('Adding remote tower:', tower);
        const towerType = this.towerTypes[tower.type];
        const newTower: Tower = {
            id: tower.id,
            x: tower.x,
            y: tower.y,
            range: towerType.range,
            damage: towerType.damage,
            attackSpeed: towerType.attackSpeed,
            lastAttackTime: 0,
            cost: towerType.cost,
            type: tower.type,
            level: 1,
            attackCooldown: 1000
        };
        this.towers.push(newTower);
    }
} 