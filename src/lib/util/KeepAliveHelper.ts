import { MessageCode } from '../constants'
import { toBoolean } from './bufferUtil'
import { createPacket } from './MessageProtocol'

const testKey = 'global/identify'

export default class KeepAliveHelper {
  #state: boolean
  #lastRecv: number
  #timeout: number
  #loop: ReturnType<typeof setInterval>

  constructor(timeout: number = 3000) {
    this.#state = false
    this.#lastRecv = null
    this.#timeout = timeout
  }

  intercept<T>(fn: (data: Buffer) => T): (data: Buffer) => T {
    return (data: Buffer) => {
      const idx = data.indexOf(0x00) // Find the NULL terminator of the key string
      if (idx !== -1) {
        const key = data.slice(0, idx).toString()
        if (key === testKey) {
          this.#lastRecv = new Date().getTime()
          return null
        }
      }

      return fn(data)
    }
  }

  // Send a KeepAlive packet every second
  start(checkFn: (data: Buffer[]) => void, failFn: () => void) {
    clearInterval(this.#loop)
    this.#loop = setInterval(() => {
      const now = new Date().getTime()

      if (now - this.#lastRecv > this.#timeout) {
        logger.debug("Timeout exceeded for keep-alive response")
        clearInterval(this.#loop)
        return failFn()
      }

      checkFn([
        createPacket(MessageCode.KeepAlive),
        createPacket(
          MessageCode.ParamValue,
          Buffer.concat([
            Buffer.from(testKey + '\x00\x00\x00'),
            toBoolean((this.#state = !this.#state))
          ])
        )
      ])
    }, 1000)

    this.#lastRecv = new Date().getTime()
  }
}
