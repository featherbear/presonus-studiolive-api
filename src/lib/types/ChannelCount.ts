import type { ChannelTypes } from "../constants";

type ChannelCount = {
	[_ in ChannelTypes]: number;
};

export default ChannelCount;
