import { EventEmitter } from "node:events";

/**
 * Detects system sleep/wake cycles by monitoring for time jumps in a periodic interval.
 *
 * When a system sleeps, JavaScript execution pauses. On wake, the next interval tick
 * fires and the elapsed wall-clock time will be far greater than the expected interval,
 * indicating a sleep/wake cycle occurred.
 */
export default class SleepWakeDetector extends EventEmitter<{ wake: [] }> {
	#loop: ReturnType<typeof setInterval> | null = null;
	#lastTick = 0;
	#intervalMs: number;
	#thresholdMs: number;

	/**
	 * @param intervalMs How often to check (default 1000ms)
	 * @param thresholdMs How much extra delay before assuming a sleep occurred (default 3000ms)
	 */
	constructor(intervalMs = 1000, thresholdMs = 3000) {
		super();
		this.#intervalMs = intervalMs;
		this.#thresholdMs = thresholdMs;
	}

	start() {
		if (this.#loop) return;
		this.#lastTick = Date.now();
		this.#loop = setInterval(() => {
			const now = Date.now();
			const elapsed = now - this.#lastTick;
			this.#lastTick = now;

			if (elapsed > this.#intervalMs + this.#thresholdMs) {
				logger.debug({ elapsed }, "System wake detected");
				this.emit("wake");
			}
		}, this.#intervalMs);
	}

	stop() {
		if (this.#loop) {
			clearInterval(this.#loop);
			this.#loop = null;
		}
	}
}
