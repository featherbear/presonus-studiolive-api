export default interface SubscriptionOptions {
	/**
	 * @internal Application name
	 */
	clientName?: string;

	/**
	 * @internal Application internal name
	 */
	clientInternalName?: string;

	/**
	 * Device name
	 * @description This value is visible in the client list
	 */
	clientDescription?: string;

	/**
	 * Device ID
	 */
	clientIdentifier?: string;

	/**
	 * ???
	 */
	clientOptions?: string;
}

export interface _InternalSubscriptionOptions extends SubscriptionOptions {
	id: "Subscribe";
	clientType: "StudioLive API";
	clientEncoding: 23106;
}
