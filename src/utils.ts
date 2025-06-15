export function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout>;
    
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
} 

// Background Image Manager
const backgroundCache: Record<string, Promise<HTMLImageElement>> = {};

/**
 * Loads a background image by name from /assets/backgrounds/<name>.png (Vite public directory).
 * Caches the result. Handles errors gracefully.
 */
export function loadBackground(name: string): Promise<HTMLImageElement> {
    if (Object.prototype.hasOwnProperty.call(backgroundCache, name)) {
        return backgroundCache[name];
    }
    backgroundCache[name] = new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => {
            console.error(`Failed to load background: ${name}`, e);
            reject(new Error(`Failed to load background: ${name}`));
        };
        img.src = `/assets/backgrounds/${name}.png`;
    });
    return backgroundCache[name];
}

/**
 * Loads and draws the background image stretched to the canvas size.
 * If loading fails, fills with a fallback color and draws an error message.
 */
export async function drawLevelBackground(
    ctx: CanvasRenderingContext2D,
    name: string,
    width?: number,
    height?: number
) {
    const w = width ?? ctx.canvas.width;
    const h = height ?? ctx.canvas.height;
    try {
        const img = await loadBackground(name);
        ctx.drawImage(img, 0, 0, w, h);
    } catch (e) {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'red';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Background not found: ${name}.png`, w / 2, h / 2);
    }
} 