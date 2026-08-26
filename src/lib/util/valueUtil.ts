type Bounds = [number, number];

/**
 * Fader taper of the console, as linear value [0-100] against decibels.
 *
 * Measured 2026-08-26 by stepping the fader through every position in the PreSonus Universal Control app,
 * bottom stop to top, and recording the level the app displayed at each one - 312 readings.
 * The taper is piecewise linear in decibels against fader travel, with corners at -60, -40 and -10 dB.
 * Interpolating between the points below reproduces every one of those readings to within 0.01 dB,
 * which is the precision the app itself displays.
 *
 * Note that the -10 dB corner places unity (0 dB) at 74.6. Set to unity by the app's own option-click
 * shortcut, the console reported 74.60000514984131 over the wire, which matches. A corner of 49.20635
 * would put unity at 74.6031746 instead; that figure is exactly 188/252 of full travel, so it is likely an
 * artefact of assuming a 253-step fader grid rather than a level any console reported. The two disagree by
 * about 0.001 dB, far below the 0.01 dB the app displays, so the measured value is kept.
 */
const volumeTaper: [linear: number, decibel: number][] = [
	[0, -84],
	[6, -60],
	[14.6, -40],
	[49.2, -10],
	[100, 10],
];

/**
 * Convert a logarithmic volume to its respective linear value [0-100]
 */
export function logVolumeToLinear(db) {
	const inputBounds: Bounds = [-84, 10];
	const outputBounds: Bounds = [0, 100];

	db = clamp(db, inputBounds);

	if (db === inputBounds[0]) return outputBounds[0];
	if (db === inputBounds[1]) return outputBounds[1];

	// `db` is now strictly inside the taper, so the segment above it always exists
	const upperIndex = volumeTaper.findIndex(([, decibel]) => db <= decibel);
	const [lowerLinear, lowerDecibel] = volumeTaper[upperIndex - 1];
	const [upperLinear, upperDecibel] = volumeTaper[upperIndex];

	const position = (db - lowerDecibel) / (upperDecibel - lowerDecibel);
	const result = lowerLinear + position * (upperLinear - lowerLinear);

	return clamp(result, outputBounds);
}

/**
 * Restrict `val` between a `min` and `max`
 */
export function clamp(val: number, [min, max]: Bounds) {
	return Math.max(min, Math.min(max, val));
}

type CancelTransitionFn = () => void;

/**
 * Transition a value along an easing sine curve.
 * _Should_ work from a -> b when a </> b
 *
 * @param from Initial value
 * @param to Final value
 * @param duration Transition period (ms)
 * @param fn Function to execute(intermediateValue)
 * @param callback Completion callback
 * @returns Cancel function
 */
export function transitionValue(
	from: number,
	to: number,
	duration: number,
	fn: (value: number) => any,
	callback?: () => void,
) {
	if (duration <= 0 || from === to) {
		fn(to);
		callback?.();
		return (() => {}) as CancelTransitionFn;
	}

	// Interval should be at least 10 ms
	const minInterval = 10;

	const curveFunction = (position: number) => {
		// Linear
		// return position

		// https://easings.net/#easeInOutSine
		return -(Math.cos(Math.PI * position) - 1) / 2;
	};

	// Interval delay
	const interval = Math.max(duration / 100, minInterval);

	const bounds: Bounds = [0, 1];
	// [0 - 1.0] Progress value to increase by
	const step = clamp(interval / duration, bounds);

	// [0 - 1.0] Current progress
	let progress = 0;

	const tick = () => {
		fn(from + (to - from) * curveFunction(progress));

		if (progress === bounds[1]) {
			cancelTransition();
			callback?.();
		} else {
			progress = clamp(progress + step, bounds);
		}
	};

	const timer = setInterval(() => tick(), interval);
	tick();

	const cancelTransition: CancelTransitionFn = () => {
		clearInterval(timer);
	};

	return cancelTransition;
}

export class UniqueRandom {
	static #instances: { [bits: number]: UniqueRandom } = {};
	static get(bits: number) {
		if (!UniqueRandom.#instances[bits]) UniqueRandom.#instances[bits] = new UniqueRandom(bits);
		return UniqueRandom.#instances[bits];
	}

	#max: number;
	#active: number[];

	constructor(bits: number) {
		this.#max = 2 ** bits - 1;
		this.#active = [];
	}

	request() {
		let current: number;

		// biome-ignore lint/suspicious/noAssignInExpressions: readability
		while (this.#active.includes((current = Math.floor(Math.random() * (this.#max + 1)))));
		this.#active.push(current);
		return current;
	}

	release(value: number) {
		this.#active = this.#active.filter((v) => v !== value);
	}

	get active() {
		return [...this.#active];
	}
}
