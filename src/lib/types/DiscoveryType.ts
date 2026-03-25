export default interface DiscoveryType {
	name: string;
	model: string;
	deviceName?: string;
	serial: string;
	ip: string;
	port: number;
	timestamp: Date;
}
