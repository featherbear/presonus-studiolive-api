import { MessageCode } from "../constants";
import { createPacket } from "./messageProtocol";
import { UniqueRandom } from "./valueUtil";

export default class KeepAliveHelper {
	#lastRecv: number;
	#timeout: number;
	#loop: ReturnType<typeof setInterval>;
	#ids: number[];

	constructor(timeout = 3000) {
		this.#lastRecv = null;
		this.#timeout = timeout;
		this.#ids = [];
	}

	updateTime() {
		this.#lastRecv = Date.now();
	}

	intercept(fn: (data: Buffer) => { id: number; data: any }): (data: Buffer) => ReturnType<typeof fn> {
		return (data: Buffer) => {
			const result = fn(data);

			if (!!result && this.#ids.includes(result.id)) {
				this.#ids = this.#ids.filter((id) => id !== result.id);
				this.updateTime();
				return null;
			}

			return result;
		};
	}

	// Send a KeepAlive packet every second
	start(checkFn: (data: Buffer[]) => void, failFn: () => void) {
		clearInterval(this.#loop);
		this.#loop = setInterval(() => {
			const now = Date.now();

			if (now - this.#lastRecv > this.#timeout) {
				logger.debug("Timeout exceeded for keep-alive response");
				clearInterval(this.#loop);
				return failFn();
			}

			const id = UniqueRandom.get(16).request();
			this.#ids.push(id);
			const idBuffer = Buffer.allocUnsafe(2);
			idBuffer.writeUInt16BE(id);

			checkFn([
				createPacket(MessageCode.KeepAlive),
				createPacket(
					MessageCode.FileRequest,
					Buffer.concat([idBuffer, Buffer.from([0x46, 0x74, 98, 0o162]), Buffer.from([0x00, 0x00])]),
				),
			]);
		}, 1000);

		this.updateTime();
	}
}
