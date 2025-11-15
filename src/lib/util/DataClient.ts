/**
 * TCP data client to receive messages from UCNet devices
 */

import { Socket } from "node:net";
import { PacketHeader } from "../constants";
import Queue from "queue";

export default function (callback, customSocket: Socket = null) {
	const TCPclient = customSocket ?? new Socket();

	let remaining = 0;
	let payload = Buffer.allocUnsafe(0);
	const Q = new Queue({
		autostart: true,
		concurrency: 1,
	});

	TCPclient.on("data", (bytes) => {
		let frame = Buffer.from(bytes);
		Q.push((finish) => {
			// 27/12/2021 @featherbear: I have no idea why we need to wrap this execution in its own inline function but we need it heh.
			(function () {
				// Desc   Header  Length   Payload
				// Size     4       2       ...
				while (frame.length !== 0) {
					if (remaining === 0 && PacketHeader.matches(frame)) {
						// Start of new packet
						const correctLength = frame.readUInt16LE(4);

						// Check the length
						if (frame.length - 6 < correctLength) {
							payload = frame;
							remaining = correctLength - (frame.length - 6);

							// Wait for the next frame
							return;
						} else {
							// Emit payload
							callback(frame.slice(0, correctLength + 6));

							// Move to next part of frame
							frame = frame.slice(correctLength + 6);
							remaining = 0;
							payload = Buffer.allocUnsafe(0);
						}
					} else if (remaining > 0) {
						// A larger payload may span over multiple packets

						// Find number of bytes to read from the new frame
						// Note: A frame may contain parts of more than one payload, so we need to receive only the remaining bytes of the current payload
						const extractN = Math.min(remaining, frame.length);

						// Append the received bytes
						payload = Buffer.concat([payload, frame.slice(0, extractN)]);
						remaining -= extractN;
						frame = frame.slice(extractN); // Move frame cursor

						// Check if all bytes received
						if (remaining === 0) {
							callback(payload);
							payload = Buffer.allocUnsafe(0);
						}

						if (remaining < 0) {
							throw Error("Extracted more bytes than the payload specified");
						}
					} else {
						// remaining is zero but the header is not matching
						throw new Error("Header not matching and remaining is zero");
					}
				}
			})();
			finish();
		});
	});

	return TCPclient;
}
