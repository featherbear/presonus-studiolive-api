import type Event from "./Event";
import type { ChannelSelector } from "../../api";

export default interface SoloEvent extends Event {
	type: "solo";
	channel: ChannelSelector;
	status: boolean;
}
