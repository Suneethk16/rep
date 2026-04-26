var _a, _b;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    server: {
        host: true,
        port: 5173,
        proxy: {
            "/api": {
                target: (_a = process.env.VITE_DEV_API_TARGET) !== null && _a !== void 0 ? _a : "http://localhost:8000",
                changeOrigin: true,
            },
            "/uploads": {
                target: (_b = process.env.VITE_DEV_API_TARGET) !== null && _b !== void 0 ? _b : "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: "dist",
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom", "react-router-dom"],
                    redux: ["@reduxjs/toolkit", "react-redux"],
                    stripe: ["@stripe/react-stripe-js", "@stripe/stripe-js"],
                },
            },
        },
    },
});
