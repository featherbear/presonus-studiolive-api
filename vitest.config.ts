import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			// Alias so ESM tests can use `import ... from "dist/esm/..."` cleanly
			"@dist": path.resolve(__dirname, "dist"),
		},
	},
});
