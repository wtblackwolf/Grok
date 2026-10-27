import { defineConfig } from 'vite';

// En dev, Vite sert le client et proxifie /api vers le serveur Node (port 8787).
// `host: true` permet de tester depuis un téléphone sur le même réseau.
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.PORT ?? 8787}`, changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: true },
});
