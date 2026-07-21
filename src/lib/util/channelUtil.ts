import { Channel, type ChannelTypes } from "../constants";
import type ChannelCount from "../types/ChannelCount";
import type ChannelSelector from "../types/ChannelSelector";

let counts: ChannelCount;

/**
 * TODO: Create a proper context
 */
export function setCounts(channelCount: ChannelCount) {
	counts = channelCount;
}

// FIXME: Add channel whitelist
export function parseChannelString(selector: ChannelSelector, _whitelist?: ChannelTypes[]) {
	let { type, channel } = selector;
	const { mixType, mixNumber } = selector;

	if (counts && mixType) {
		if (!mixNumber || mixNumber < 1) {
			throw new Error("Invalid mix channel provided");
		}

		switch (mixType) {
			case "AUX":
			case "FX":
				if (!(mixNumber <= counts[mixType])) throw new Error("Invalid mix channel provided");
				break;
			default:
				throw new Error("Invalid mix type provided");
		}
	}

	// `type` must be a valid enum key
	if (!Object.keys(Channel).includes(type)) {
		throw new Error("Invalid channel type provided");
	}

	if (["MAIN", "TALKBACK"].includes(type)) {
		// Force channel = 1 for main and talkback channels
		channel = 1;
	}

	const oldChannel = channel;
	channel = Math.trunc(channel);

	if (
		// `channel` must be a whole number larger than zero
		!(channel > 0) ||
		channel !== oldChannel ||
		// `channel` must also be less than the known maximum (if a max is provided)
		(counts && !(counts[type] && counts[type] >= channel))
	) {
		throw new Error("Invalid channel provided");
	}

	return `${Channel[type]}/ch${channel}`;
}
