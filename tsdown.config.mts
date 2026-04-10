import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		api: "src/api.ts",
		"simple/index": "src/simple/index.ts",
	},
	format: ["esm", "cjs"],
	outDir: "dist",
	platform: "node",
	target: "es2022",
	sourcemap: false,
	clean: false,
	// platform:node defaults fixedExtension:true → .mjs for ESM, .cjs for CJS
	// Disable hash suffixes on shared chunks for stable filenames
	hash: false,
	// Disable auto-generated declarations; types are emitted separately by tsc -p tsconfig.types.json
	dts: false,
	// Keep runtime dependencies external (not bundled into the output)
	deps: {
		neverBundle: ["bunyan", "queue"],
	},
	// Name the shared internal chunk instead of letting rolldown auto-generate "api2"
	outputOptions: (options, format) => ({
		chunkFileNames: `_internal${format === "cjs" ? ".cjs" : ".mjs"}`,
	}),
	tsconfig: "tsconfig.json",
});
