import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Discovery from "../src/lib/Discovery";

/**
 * Discovery unit tests (always run) + hardware validation (when .mixers.json exists).
 *
 * Hardware tests require a `.mixers.json` file at the repo root (gitignored):
 * {
 *   "mixers": [
 *     { "ip": "192.168.1.10", "label": "Mixer 1" },
 *     { "ip": "192.168.1.11", "label": "Mixer 2" }
 *   ]
 * }
 */

const MIXERS_PATH = resolve(__dirname, "../.mixers.json");

function loadExpectedMixers(): { ip: string; label: string }[] {
	if (!existsSync(MIXERS_PATH)) return [];
	try {
		const data = JSON.parse(readFileSync(MIXERS_PATH, "utf-8"));
		return data.mixers || [];
	} catch {
		return [];
	}
}

describe("Discovery", () => {
	// ---- Unit tests (no hardware needed) ----

	it("creates a Discovery instance", () => {
		const d = new Discovery();
		expect(d).toBeDefined();
		expect(d).toBeInstanceOf(Discovery);
	});

	it("emits discover events", () => {
		const d = new Discovery();
		expect(typeof d.on).toBe("function");
		expect(typeof d.emit).toBe("function");
	});

	it("can start and stop without error", async () => {
		const d = new Discovery();
		await d.start(100);
		// Should have stopped automatically after timeout
		expect(d.socket).toBeUndefined();
	});

	it("stop is idempotent", () => {
		const d = new Discovery();
		d.stop();
		d.stop(); // Should not throw
	});

	// ---- Hardware validation (skipped if .mixers.json is missing) ----

	const expectedMixers = loadExpectedMixers();
	const hasHardware = expectedMixers.length > 0;

	describe.skipIf(!hasHardware)("hardware discovery (.mixers.json)", () => {
		// Mixers broadcast every ~5s; allow enough time to catch at least 2 cycles
		const SCAN_TIMEOUT = 15_000;

		it(
			"finds all expected mixers on the network",
			async () => {
				const d = new Discovery();
				const foundIPs = new Set<string>();

				d.on("discover", (info) => {
					foundIPs.add(info.ip);
				});

				await d.start(SCAN_TIMEOUT);

				for (const mixer of expectedMixers) {
					expect(
						foundIPs.has(mixer.ip),
						`Expected to find mixer "${mixer.label}" at ${mixer.ip} but it was not discovered. Found: [${[...foundIPs].join(", ")}]`,
					).toBe(true);
				}
			},
			SCAN_TIMEOUT + 5000,
		);

		it(
			"returns valid discovery data for each mixer",
			async () => {
				const d = new Discovery();
				const discoveries = new Map<string, any>();

				d.on("discover", (info) => {
					if (!discoveries.has(info.ip)) {
						discoveries.set(info.ip, info);
					}
				});

				await d.start(SCAN_TIMEOUT);

				for (const mixer of expectedMixers) {
					const info = discoveries.get(mixer.ip);
					if (!info) continue; // Already covered by the previous test

					expect(info.model).toBeTruthy();
					expect(info.model).toMatch(/^(StudioLive|CS18AI|NSB)/i);
					expect(info.serial).toBeTruthy();
					expect(info.ip).toBe(mixer.ip);
					expect(info.timestamp).toBeInstanceOf(Date);
				}
			},
			SCAN_TIMEOUT + 5000,
		);
	});
});
