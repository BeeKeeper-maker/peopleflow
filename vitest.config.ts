import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
        exclude: ["node_modules", ".next", "src/generated"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["src/lib/**", "src/app/api/**"],
            exclude: ["src/generated/**", "src/**/*.test.ts"],
        },
        setupFiles: ["./src/tests/setup.ts"],
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
