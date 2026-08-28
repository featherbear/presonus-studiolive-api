export default interface DiscoveryType {
	/**
	 * Device model, e.g. "StudioLive 16R".
	 * Named `name` for backward compatibility; prefer `model`.
	 */
	name: string;
	/** Device model, e.g. "StudioLive 16R". */
	model?: string;
	/**
	 * User-assigned device name, e.g. "Office".
	 * Absent when the console broadcasts no name.
	 */
	deviceName?: string;
	serial: string;
	ip: string;
	port: number;
	timestamp: Date;
}
