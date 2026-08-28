/**
 * Per-channel switches that carry a single on/off value on the console.
 *
 * The values are the console's own parameter paths, relative to a channel —
 * `parseChannelString()` supplies the `line/ch3` part. They are grouped here
 * rather than given a setter each because they behave identically on the wire:
 * a ParamValue packet carrying a 4-byte float of 1 or 0.
 *
 * The console is inconsistent about how it reports them — `48v` arrives as a
 * boolean while `polarity` and the processor switches arrive as 1/0 numbers,
 * and an echoed change arrives as a Buffer — so read them through
 * `Client#getSwitch`, which normalises all three.
 */
export const ChannelSwitch = {
	/** Phantom power. Can damage ribbon microphones. */
	phantom: "48v",
	/** Polarity (phase) invert. */
	polarity: "polarity",
	/** Sum the channel to mono. */
	mono: "mono",
	/** Noise gate in/out. */
	gate: "gate/on",
	/** Compressor in/out. */
	compressor: "comp/on",
	/** Channel EQ in/out. */
	eq: "eq/eqallon",
	/** Limiter in/out. */
	limiter: "limit/limiteron",
} as const;

export type ChannelSwitchName = keyof typeof ChannelSwitch;
