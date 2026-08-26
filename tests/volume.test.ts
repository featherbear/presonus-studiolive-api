/**
 * Decibel -> linear fader value tests.
 *
 * `logVolumeToLinear` interpolates a taper measured from the PreSonus Universal
 * Control app on 2026-08-26 (312 fader positions, bottom stop to top). These
 * tests pin the corners of that taper, its endpoint behaviour, and the two
 * defects of the cubic it replaced: divergence below about -15 dB, and the
 * `Math.trunc` that quantised every result to a whole percent of fader travel.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { logVolumeToLinear } from "../src/lib/util/valueUtil";

/** Corners of the measured taper: [decibel, linear] */
const CORNERS: [number, number][] = [
	[-84, 0],
	[-60, 6],
	[-40, 14.6],
	[-10, 49.2],
	[10, 100],
];

/**
 * The measured sweep, as [app_db, linear] pairs, where linear is the fader
 * position as a percentage of travel. The app's grid has 312 positions, so
 * `position` sits at `position / 311 * 100` percent.
 *
 * This is the data the taper was fitted to; the corner and regression tests
 * above do not depend on it.
 */
const SWEEP: [number, number][] = fs
	.readFileSync(path.resolve(__dirname, "fixtures", "uc-fader-sweep-2026-08-26.csv"), "utf8")
	.split("\n")
	.filter((line) => line && !line.startsWith("#") && !line.startsWith("position"))
	.map((line) => {
		const [position, decibel] = line.split(",");
		return [Number(decibel), (Number(position) / 311) * 100];
	});

describe("logVolumeToLinear: taper corners", () => {
	it.each(CORNERS)("maps %d dB to %d", (decibel, linear) => {
		expect(logVolumeToLinear(decibel)).toBeCloseTo(linear, 6);
	});

	it("puts unity (0 dB) at 74.6, not 72", () => {
		expect(logVolumeToLinear(0)).toBeCloseTo(74.6, 6);
	});

	it("interpolates within a segment", () => {
		// midpoint of the -40 dB .. -10 dB segment
		expect(logVolumeToLinear(-25)).toBeCloseTo(14.6 + (49.2 - 14.6) / 2, 6);
		// -20 dB, two thirds down that same segment
		expect(logVolumeToLinear(-20)).toBeCloseTo(37.666666, 5);
	});
});

describe("logVolumeToLinear: endpoints", () => {
	it("returns exactly 0 at the bottom stop", () => {
		expect(logVolumeToLinear(-84)).toBe(0);
	});

	it("returns exactly 100 at the top", () => {
		expect(logVolumeToLinear(10)).toBe(100);
	});

	it.each([-85, -100, -1000, Number.NEGATIVE_INFINITY])("clamps %p to 0", (decibel) => {
		expect(logVolumeToLinear(decibel)).toBe(0);
	});

	it.each([10.1, 20, 1000, Number.POSITIVE_INFINITY])("clamps %p to 100", (decibel) => {
		expect(logVolumeToLinear(decibel)).toBe(100);
	});
});

describe("logVolumeToLinear: shape", () => {
	it("is monotonically increasing across the whole range", () => {
		let previous = Number.NEGATIVE_INFINITY;
		for (let decibel = -84; decibel <= 10; decibel += 0.1) {
			const linear = logVolumeToLinear(decibel);
			expect(linear).toBeGreaterThan(previous);
			previous = linear;
		}
	});

	it("stays within [0, 100] across the whole range", () => {
		for (let decibel = -84; decibel <= 10; decibel += 0.1) {
			const linear = logVolumeToLinear(decibel);
			expect(linear).toBeGreaterThanOrEqual(0);
			expect(linear).toBeLessThanOrEqual(100);
		}
	});

	it("returns non-integer values - the result is no longer truncated", () => {
		// Every one of these truncated to a whole percent under the old cubic
		for (const decibel of [-3.5, -12.25, -33.7, -55.1]) {
			expect(logVolumeToLinear(decibel) % 1).not.toBe(0);
		}
	});
});

describe("logVolumeToLinear: regressions against the fitted cubic", () => {
	it("does not silence the channel at -60 dB", () => {
		// The cubic returned 0 here, which is the bottom stop: -60 dB came out silent.
		expect(logVolumeToLinear(-60)).toBe(6);
		expect(logVolumeToLinear(-60)).toBeGreaterThan(0);
	});

	it("keeps everything above the bottom stop audible", () => {
		for (let decibel = -83.9; decibel <= -55; decibel += 0.1) {
			expect(logVolumeToLinear(decibel)).toBeGreaterThan(0);
		}
	});

	it.each([
		[-20, 37.666666],
		[-40, 14.6],
		[-50, 10.3],
		[-60, 6],
	])("no longer under-reports %d dB", (decibel, expected) => {
		expect(logVolumeToLinear(decibel)).toBeCloseTo(expected, 5);
	});
});

describe("logVolumeToLinear: measured sweep", () => {
	it("reads the full sweep from the fixture", () => {
		expect(SWEEP).toHaveLength(312);
		expect(SWEEP[0]).toEqual([-84, 0]);
		expect(SWEEP[311]).toEqual([10, 100]);
	});

	it("converts positions to the linear values the console reports", () => {
		// Position 150 read back as 48.23151230812073 over the wire against the 48.23151125 this
		// conversion gives - a float32 rounding apart. The fixture's linear axis is the console's.
		const [, linear] = SWEEP[150];
		expect(Math.abs(linear - 48.23151230812073)).toBeLessThan(1e-5);
	});

	it("reproduces every reading to within the app's display precision", () => {
		// The app displays two decimal places. Expressed back in dB, the taper is
		// within 0.01 dB of all 312 readings; 0.05 percent of travel is that bound
		// with room to spare in the coarsest segment.
		for (const [decibel, linear] of SWEEP) {
			expect(Math.abs(logVolumeToLinear(decibel) - linear)).toBeLessThan(0.05);
		}
	});
});

describe("logVolumeToLinear: between the app's grid positions", () => {
	/**
	 * Every row of the sweep sits on one of the app's 312 fader positions, so the fixture alone cannot
	 * show the taper is right *between* them - which is exactly what dropping `Math.trunc` claims.
	 *
	 * Unity is the case that tests it. The app's option-click shortcut sets unity exactly, and unity
	 * lands between positions 232 (74.598071) and 233 (74.919614) rather than on either one. Set that
	 * way, the console reported 74.60000514984131 over the wire.
	 */
	it("matches the level the console reported at unity, which falls between two positions", () => {
		expect(Math.abs(logVolumeToLinear(0) - 74.60000514984131)).toBeLessThan(0.001);
	});
});
