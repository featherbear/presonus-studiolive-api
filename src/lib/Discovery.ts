/**
 * Device discovery client
 * Listen to the `discover` event with <Discover>.on('discover', callback)
 */

import { analysePacket } from "./util/messageProtocol";
import { EventEmitter } from "node:events";
import dgram from "node:dgram";
import { networkInterfaces } from "node:os";
import type DiscoveryType from "./types/DiscoveryType";

/**
 * Get all local IP addresses from network interfaces
 * @returns Set of local IP addresses
 */
function getLocalIPs(): Set<string> {
	const localIPs = new Set<string>();
	const interfaces = networkInterfaces();

	for (const name of Object.keys(interfaces)) {
		const iface = interfaces[name];
		if (!iface) continue;

		for (const addr of iface) {
			// Add both IPv4 and IPv6 addresses
			localIPs.add(addr.address);
		}
	}

	// Also add common loopback addresses
	localIPs.add("127.0.0.1");
	localIPs.add("::1");
	localIPs.add("localhost");

	return localIPs;
}

/**
 * Check if an IP address belongs to the local machine
 * @param ip IP address to check
 * @param localIPs Set of local IP addresses
 * @returns true if the IP is a local address
 */
function isLocalIP(ip: string, localIPs: Set<string>): boolean {
	// Direct match
	if (localIPs.has(ip)) return true;

	// Check for IPv4 loopback range (127.0.0.0/8)
	if (ip.startsWith("127.")) return true;

	return false;
}

export default class Discovery extends EventEmitter {
	socket: dgram.Socket;

	/**
	 * Scan for devices
	 *
	 * @param timeout Duration (in milliseconds) to discover for, or indefinitely if empty
	 * @returns
	 */
	async start(timeout = null) {
		return new Promise<void>((resolve, reject) => {
			this.stop();
			this.setup();

			if (timeout !== null) {
				setTimeout(() => {
					this.stop();
					resolve();
				}, timeout);
			}
		});
	}

	/**
	 * Shut down discovery client
	 */
	stop() {
		if (this.socket !== undefined) {
			this.socket.close();
			this.socket = undefined;
		}
	}

	/**
	 * Setup routine
	 */
	private setup() {
		// Get local IPs to filter out
		const localIPs = getLocalIPs();

		// Listen to broadcast on port 47809
		const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
		socket.bind(47809, "0.0.0.0");
		socket.on("listening", function () {
			this.setBroadcast(true);
		});

		socket.on("message", (packet, rinfo) => {
			const [code, data] = analysePacket(packet, true);
			if (!code) return;

			// Filter out local machine's own IP addresses
			if (isLocalIP(rinfo.address, localIPs)) {
				return;
			}

			// Split data by null byte
			const fragments = [];
			for (let payload = data.slice(20), cur = 0, f: Buffer; cur < payload.length; cur += f.length + 1) {
				f = payload.slice(cur, payload.indexOf("\x00", cur));
				fragments.push(f.toString("utf8"));
			}

			// eslint-disable-next-line
			const [nameA, _, serial, nameB] = fragments;

			if (!serial) return;

			// nameA: Model number for device image identification
			// nameB: ???
			this.emit("discover", {
				name: nameA,
				serial,
				ip: rinfo.address,
				port: rinfo.port,
				timestamp: new Date(),
			} as DiscoveryType);
		});

		this.socket = socket;
	}
}
