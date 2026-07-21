/**
 * Test setup: create a silent global logger stub so modules that reference
 * `globalThis.logger` work without importing bunyan.
 */

const noop = () => {};

globalThis.logger = {
	trace: noop,
	debug: noop,
	info: noop,
	warn: noop,
	error: noop,
	fatal: noop,
	level: noop,
	child: () => globalThis.logger,
} as any;

// Ensure Buffer.matches is available in tests
import "../src/lib/util/bufferUtil";
