import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/dist/**", "**/node_modules/**"],
    include: ["packages/**/*.test.ts", "packages/**/*.test.mjs"]
  }
});
