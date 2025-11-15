import * as dgram from "node:dgram";
import { MessageCode, PacketHeader } from "./constants";

export type MeterData = {};

export enum MeterGroups {
	INPUT_SIGNAL = 0x0000,
	/* Basically the same as the input signal */
	INPUT_GATE_IN = 0x0001,
	INPUT_GATE_OUT = 0x0002,
	INPUT_STRIP1_OUT = 0x0003,
	INPUT_STRIP2_OUT = 0x0004,
	INPUT_LIMITER_OUT = 0x0005,

	/**
	 * i.e. FX Returns, Digital Return, Talkback
	 */
	RETURNS = 0x0200,

	AUX_SENDS = 0x0400,
	// 0402 - When an aux is set to matrix, the value is 0
	AUX_STRIP_IN = 0x0402,
	AUX_STRIP1_OUT = 0x0403,
	AUX_STRIP2_OUT = 0x0404,
	AUX_LIMITER_OUT = 0x0405,

	FX_SENDS = 0x0500,

	MAIN_SENDS = 0x0700,
	MAIN_STRIP_IN = 0x0702,
	MAIN_STRIP1_OUT = 0x0703,
	MAIN_STRIP2_OUT = 0x0704,
	MAIN_LIMITER_OUT = 0x0705,
}

export function parseDataFrame(data: Buffer<ArrayBufferLike>) {
	if (!data.subarray(0, 4).equals(PacketHeader)) return;
	if (data.subarray(6, 8).toString() !== MessageCode.Meter16) return;

	// const PORT = data.slice(4, 6) // length is given as cf08 = 53000, but the payload is only 1041 long

	const type = data.subarray(12, 16).toString();

	switch (type) {
		case "levl": {
			const valueCount = data.readUInt16LE(18);

			// All the values (u16) are stored together
			const values: number[] = [];
			for (let i = 0; i < valueCount; i++) {
				values.push(data.readUInt16LE(20 + i * 2));
			}

			// There is a count (u8) of groups that describe the values
			const descriptorsCount = data[20 + valueCount * 2];

			if (21 + valueCount * 2 + descriptorsCount * 6 !== data.length) {
				throw new Error("Decode error: Algorithm incorrect");
			}

			const meterData: MeterData = {};
			for (let i = 0; i < descriptorsCount; i++) {
				// Read each descriptor
				const descriptorOffset = 21 + valueCount * 2 + i * 6;
				const [groupNumber, offset, count] = [
					data.readInt16BE(descriptorOffset),
					data.readInt16LE(descriptorOffset + 2),
					data.readInt16LE(descriptorOffset + 4),
				];
				const groupValues: number[] = values.slice(offset, offset + count);

				// const title_text = (
				//   Groups[groupNumber] ||
				//   "> " + groupNumber.toString(16).padStart(4, "0")
				// ).padEnd(20, " ");
				// const channel_count_text = count.toString().padStart(2, " ");
				// const values_text = groupValues
				//   .map((v: number) => v.toString(16).padStart(4, "0"))
				//   .join(" ");
				// console.log(`${title_text} [${channel_count_text}]: ${values_text}`);

				meterData["type"] = "level";
				meterData[groupNumber] = groupValues;
			}

			return meterData;
		}
		case "redu": {
			// reduction
			// from both the EQ and Limiter, probably also from the compressor
			break;
		}
		case "rtan": {
			// realtime analyzer
			break;
		}
		default: {
			console.warn("Unknown message type:", type);
		}
	}
}

/**
 * Create a UDP server and await data.
 *
 * This function **does not** send the packet to initiate the meter data request,
 * it relies on a request sent from the <API>.meterSubscribe method
 *
 * @param port UDP port to listen on
 * @param channelCounts Channel count data
 * @param onData Callback
 */
export default function createServer(port, onData: (data: MeterData) => any) {
	if (typeof port !== "number" || port < 0 || port > 65535) {
		throw Error("Invalid port number");
	}

	// Create UDP Server to listen to metering data
	const UDPserver = dgram.createSocket("udp4");

	UDPserver.on("error", (err) => {
		UDPserver.close();
		throw Error("Meter server error: " + err.stack);
	});

	return new Promise<dgram.Socket>((resolve) => {
		UDPserver.on("message", (msg, rinfo) => {
			const data = Buffer.from(msg);
			const parsed = parseDataFrame(data);
			if (parsed) {
				onData(parsed);
			}
		});

		UDPserver.on("listening", () => {
			console.log("Listening on port", UDPserver.address().port);
			resolve(UDPserver);
		});
		UDPserver.bind(port);
	});
}
