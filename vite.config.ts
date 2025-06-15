import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 5173,
        host: true,
        open: true,
        hmr: true,
        watch: {
            usePolling: true
        }
    },
    build: {
        target: 'esnext',
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true
    },
    publicDir: 'public',
    assetsInclude: ['**/*.png'],
    optimizeDeps: {
        force: true,
        include: ['**/*.ts', '**/*.js']
    },
    plugins: [
        {
            name: 'force-reload',
            handleHotUpdate({ file, server }) {
                server.ws.send({
                    type: 'full-reload',
                    path: '*'
                });
                return [];
            }
        }
    ],
    clearScreen: false,
    logLevel: 'info'
}); 