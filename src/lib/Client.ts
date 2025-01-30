import './util/logging'

import type { DiscoveryType, ChannelCount, SubscriptionOptions, ChannelSelector, FileListItem } from './types'
import type * as InstanceOptions from './types/InstanceOptions'
import type { MeterData } from './MeterServer'

import { Channel, ChannelTypes, MessageCode, ConnectionState } from './constants'

import { EventEmitter } from 'events'

import * as packetParser from './packetParser'
import Discovery from './Discovery'
import MeterServer from './MeterServer'

import DataClient from './util/DataClient'
import { analysePacket, createPacket } from './util/messageProtocol'
import { parseChannelString, setCounts } from './util/channelUtil'
import { toShort, toFloat, toBoolean } from './util/bufferUtil'
import { craftSubscribe, unsubscribePacket } from './util/subscriptionUtil'
import CacheProvider from './util/CacheProvider'
import { tokenisePath } from './util/treeUtil'
import { doesLookupMatch } from './util/ValueTransformer'
import { ignorePV } from './util/transformers'
import { logVolumeToLinear, transitionValue, UniqueRandom } from './util/valueUtil'
import { dumpNode, ZlibNode } from './util/zlib/zlibNodeParser'
import { getZlibValue } from './util/zlib/zlibUtil'
import KeepAliveHelper from './util/KeepAliveHelper'
import * as FDHelper from './util/fileRequestUtil'
import { JSONtoPacketBuffer } from './util/jsonPacketUtil'

// Forward discovery events
const discovery = new Discovery()

type fnCallback<T = any> = (obj: T) => void;
type dataFnCallback<T = any> = (obj: {
  code: any,
  data: T
}) => void;

type EventFunctionType<T> = {
  (event: MessageCode, listener: fnCallback): T
  (event: keyof typeof ConnectionState, listener: fnCallback<void>): T
  (event: 'meter', listener: fnCallback<MeterData>): T
  (event: 'data', listener: dataFnCallback): T
}
export class Client {
  readonly serverHost: string
  readonly serverPort: number
  readonly options: Partial<InstanceOptions.InstanceOptions>

  channelCounts: ChannelCount

  meteringClient: Awaited<ReturnType<typeof MeterServer>>
  #eventEmitter: EventEmitter
  #keepAliveHelper: KeepAliveHelper

  readonly state: ReturnType<typeof CacheProvider>
  private zlibData?: ZlibNode

  private conn: ReturnType<typeof DataClient>
  private connectPromise: Promise<Client>

  constructor(address: InstanceOptions.ConnectionAddress, options?: Partial<InstanceOptions.InstanceOptions>) {
    if (!address?.host) throw new Error('Host address not supplied')

    this.#eventEmitter = new EventEmitter()

    this.serverHost = address.host
    this.serverPort = address?.port || 53000
    this.options = options

    if (typeof this.options?.logLevel !== 'undefined') {
      logger.level(this.options.logLevel)
    }

    this.meteringClient = null

    this.conn = DataClient(this.handleRecvPacket.bind(this))

    this.state = CacheProvider({
      get: (key) => this.zlibData ? getZlibValue(this.zlibData, key) : null
    })

    this.on(MessageCode.ZLIB, (ZB) => {
      this.zlibData = ZB
    })

    this.on(MessageCode.ParamValue, ({ name, value }) => {
      // Tokenise ahead of time
      name = tokenisePath(name)

      for (const ignoreKey of ignorePV) {
        if (doesLookupMatch(ignoreKey, name)) return
      }

      this.state.set(name, value)
    })

    this.on(MessageCode.ParamString, ({ name, value }) => {
      this.state.set(name, value)
    })

    this.on(MessageCode.ParamChars, ({ name, value }) => {
      this.state.set(name, value)
    })

    this.on(MessageCode.FaderPosition, (MS: { [_ in ChannelTypes]: number[] }) => {
      for (const [type, values] of Object.entries(MS)) {
        for (let i = 0; i < values.length; i++) {
          this.state.set(`${Channel[type]}/ch${i + 1}/volume`, values[i])
        }
      }
    })

    this.on(MessageCode.FileData, ({ id, data }) => {
      this.emit(`_${MessageCode.FileData}_${id}`, data)
    })
  }

  emit(...args: Parameters<EventEmitter['emit']>) {
    return this.#eventEmitter.emit(...args)
  }

  on = (function (...args) {
    this.#eventEmitter.on(...args)
    return this
  }) as EventFunctionType<this>

  addListener = (function (...args) {
    this.#eventEmitter.addListener(...args)
    return this
  }) as EventFunctionType<this>

  once = (function (...args) {
    this.#eventEmitter.once(...args)
    return this
  }) as EventFunctionType<this>

  off = (function (...args) {
    this.#eventEmitter.off(...args)
    return this
  }) as EventFunctionType<this>

  removeListener = (function (...args) {
    this.#eventEmitter.removeListener(...args)
    return this
  }) as EventFunctionType<this>

  /**
   * Extracts the data structure and cache layer
   * @internal
   */
  dumpState(): any {
    return {
      internal: dumpNode(this.zlibData),
      cache: this.state._data.toJSON()
    }
  }

  static async discover(timeout = 10 * 1000) {
    const devices: { [serial: string]: DiscoveryType } = {}
    const func = device => {
      devices[device.serial] = device
    }

    discovery.on('discover', func)
    await discovery.start(timeout)
    discovery.off('discover', func)

    return Object.values(devices)
  }

  /**
   * Subscribe to the metering data
   */
  async meterSubscribe(port?: number) {
    port = port ?? 0
    this.meteringClient = await MeterServer.call(this, port, this.channelCounts, (meterData: MeterData) => this.emit('meter', meterData))
    this._sendPacket(MessageCode.Hello, toShort(this.meteringClient.address().port), 0x00)
  }

  /**
   * Unsubscribe from the metering data
   */
  meterUnsubscribe() {
    if (!this.meteringClient) return
    this.meteringClient.close()
    this.meteringClient = null
  }

  async connect(subscribeData?: SubscriptionOptions) {
    if (this.connectPromise) return this.connectPromise

    return (this.connectPromise = new Promise((resolve, reject) => {
      let fastReconnectTimer: ReturnType<typeof setTimeout>
      logger.info({ host: this.serverHost, port: this.serverPort }, 'Connecting to console')

      const reconnect = () => {
        logger.debug('Reconnecting')
        doConnect()
      }

      this.conn.addListener('connect', () => {
        clearTimeout(fastReconnectTimer)

        this.#keepAliveHelper = new KeepAliveHelper(3000)

        // #region Connection handshake

        // The zlib payload may come either as a ZB or CK packet
        const chunkedZlibInitCallback = (data) => {
          this.removeListener(MessageCode.Chunk, chunkedZlibInitCallback)
          this.emit(MessageCode.ZLIB, data)
        }
        this.addListener(MessageCode.Chunk, chunkedZlibInitCallback)

        Promise.all([
          new Promise((resolve) => {
            this.once(MessageCode.ZLIB, () => {
              // De-register the listener in case the payload was not encapsulated in a CK packet
              this.removeListener(MessageCode.Chunk, chunkedZlibInitCallback)

              const getCount = (key) => Object.keys(this.state.get(key) ?? {}).length
              setCounts((this.channelCounts = {
                LINE: getCount('line'),
                AUX: getCount('aux'),
                FX /* fxbus == fxreturn */: getCount('fxbus'),
                FXRETURN: getCount('fxreturn'),
                RETURN /* aka tape? */: getCount('return'),
                TALKBACK: getCount('talkback'),
                MAIN: getCount('main'),
                DCA: getCount('filtergroup'),
                SUB: getCount('sub') /* TODO: The 16R doesn't have SUB groups. Check against the 24R / 16 */
              }))
              resolve(this)
            })
          }),

          /**
           * Await for the subscription success
           */
          new Promise((resolve) => {
            const subscribeCallback = data => {
              if (data.id === 'SubscriptionReply') {
                this.removeListener(MessageCode.JSON, subscribeCallback)
                resolve(this)
              }
            }
            this.addListener(MessageCode.JSON, subscribeCallback)
          })
        ]).then(() => {
          this.#keepAliveHelper.start(
            (packets) => {
              packets.forEach((bytes) => this._writeBytes(bytes))
            }, () => {
              if (!this.conn.destroyed) this.conn.destroy()
              logger.info('Connection closed')
              this.emit('closed')

              if (this.options?.autoreconnect) {
                this.emit('reconnecting')
                reconnect()
              }
            })

          logger.info('Connected')
          this.emit('connected')
          resolve(this)
        })

        // Send subscription request
        this._sendPacket(MessageCode.JSON, craftSubscribe(subscribeData))
        // #endregion
      })

      const doConnect = () => {
        this.conn.destroy()
        this.conn.connect(this.serverPort, this.serverHost)
        fastReconnectTimer = setTimeout(() => reconnect(), 2000)
        this.conn.once('error', () => { })
      }

      doConnect()
    }))
  }

  async close() {
    this.meterUnsubscribe()
    await this._sendPacket(MessageCode.JSON, unsubscribePacket).then(() => {
      this.conn.destroy()
    })
  }

  /**
   * Analyse, decode and emit packets
   */
  private handleRecvPacket(packet) {
    let [messageCode, data] = analysePacket(packet)
    if (messageCode === null) return

    // Handle message types
    // eslint-disable-next-line
    const handlers: { [k in MessageCode]?: (data) => any } = {
      [MessageCode.JSON]: packetParser.handleJMPacket,
      [MessageCode.ParamValue]: packetParser.handlePVPacket,
      [MessageCode.ParamString]: packetParser.handlePSPacket,
      [MessageCode.ZLIB]: packetParser.handleZBPacket,
      [MessageCode.FaderPosition]: packetParser.handleMSPacket,
      [MessageCode.Chunk]: packetParser.handleCKPacket,
      [MessageCode.ParamChars]: packetParser.handlePCPacket,
      [MessageCode.FileData]: this.#keepAliveHelper.intercept(packetParser.handleFDPacket),
      [MessageCode.DeviceList]: null,
      [MessageCode.Unknown1]: null,
      [MessageCode.Unknown3]: null
    }

    if (Object.prototype.hasOwnProperty.call(handlers, messageCode)) {
      data = handlers[messageCode]?.call?.(this, data)
    } else {
      console.warn('Unhandled message code', messageCode)
    }

    if (!data) return
    this.emit(messageCode, data)
    this.emit('data', { code: messageCode, data })
  }

  /**
   * Get projects stored on the console
   * @param complete Should scenes be fetched as well
   */
  async getProjects(complete: true): Promise<FileListItem.ProjectItem<{ scenes: FileListItem.SceneItem[] }>[]>
  async getProjects(complete?: false): Promise<FileListItem.ProjectItem[]>
  async getProjects(complete?: boolean) {
    if (!complete) return this.sendList(FDHelper.PROJECTS)

    const result: FileListItem.ProjectItem<{ scenes: FileListItem.SceneItem[] }>[] = []

    for (const project of await this.getProjects(false)) {
      result.push({
        ...project,
        scenes: await this.getScenesOfProject(project.name)
      })
    }

    return result
  }

  /**
   * Get channel presets stored on the console
   */
  getChannelPresets(): Promise<FileListItem.ChannelPresetItem[]> {
    return this.sendList(FDHelper.CHANNEL_PRESETS)
  }

  /**
   * Get scenes of a project stored on the console
   */
  getScenesOfProject(projFile: string): Promise<FileListItem.SceneItem[]> {
    return this.sendList(FDHelper.SCENES_OF(projFile))
  }

  /**
   * Current loaded scene
   */
  get currentScene() {
    const path: string = this.state.get('presets.loaded_scene_name', '')
    return path.slice(path.lastIndexOf('/') + 1) || null
  }

  /**
   * Current loaded project
   */
  get currentProject() {
    const path: string = this.state.get('presets.loaded_project_name', '')
    return path.slice(path.lastIndexOf('/') + 1) || null
  }

  sendList(key: typeof FDHelper.PROJECTS): Promise<FileListItem.ProjectItem[]>
  sendList(key: typeof FDHelper.CHANNEL_PRESETS): Promise<FileListItem.ChannelPresetItem[]>
  sendList(key: ReturnType<typeof FDHelper.SCENES_OF>): Promise<FileListItem.SceneItem[]>
  sendList<T = unknown>(key: string): Promise<T> {
    const id = UniqueRandom.get(16).request()

    const idBuffer = Buffer.allocUnsafe(2)
    idBuffer.writeUInt16BE(id) // Different to bufferUtil::toShort()

    return new Promise<T>((resolve, reject) => {
      // eslint-disable-next-line prefer-const
      let timeout: ReturnType<typeof setTimeout>

      const callback = (data: any) => {
        clearTimeout(timeout)

        if (
          key === FDHelper.PROJECTS ||
          key === FDHelper.CHANNEL_PRESETS ||
          key.startsWith(FDHelper.SCENES_OF(''))
        ) {
          data = data?.files
            ?.filter(({ title }) => title !== '* Empty Location *')
            ?.filter(({ name }) => !(name.endsWith('.lock') || name.endsWith('.cnfg')))
        }

        return resolve(data)
      }

      const eventName = `_${MessageCode.FileData}_${id}`
      this.once(<any>eventName, callback)

      this._sendPacket(
        MessageCode.FileRequest,
        Buffer.concat([
          idBuffer,
          Buffer.from('List' + key.toString()),
          Buffer.from([0x00, 0x00])
        ])
      )

      timeout = setTimeout(() => {
        this.removeListener(<any>eventName, callback)
        UniqueRandom.get(16).release(id)
        reject(new Error('Timeout'))
      }, 10 * 1000)
    })
  }

  /**
   * Send bytes to the console
   */
  private async _sendPacket(...params: Parameters<typeof createPacket>) {
    return this._writeBytes(createPacket(...params))
  }

  private async _writeBytes(bytes: Buffer) {
    return new Promise((resolve) => {
      this.conn.write(bytes, null, (resp) => {
        resolve(resp)
      })
    })
  }

  /**
   * @param projFile e.g 01.Showfile.proj
   */
  recallProject(projFile: string) {
    this._sendPacket(MessageCode.JSON, JSONtoPacketBuffer(
      {
        id: 'RestorePreset',
        url: 'presets',
        presetTarget: '',
        presetTargetSlave: 0,
        presetFile: 'presets/proj/' + projFile
      }
    ))
  }

  /**
   *
   * @param projFile e.g. 01.Showfile.proj
   * @param sceneFile e.g. 02.SceneBackup.scn
   */
  recallProjectScene(projFile: string, sceneFile: string) {
    this._sendPacket(MessageCode.JSON, JSONtoPacketBuffer(
      {
        id: 'RestorePreset',
        url: 'presets',
        presetTarget: '',
        presetTargetSlave: 0,
        presetFile: `presets/proj/${projFile}/${sceneFile}`
      })
    )
  }

  recallChannelStrip(selector: ChannelSelector, chanFile: string) {
    this._sendPacket(MessageCode.JSON, JSONtoPacketBuffer(
      {
        id: 'RestorePreset',
        url: 'presets',
        // FIXME: Implement whitelist
        presetTarget: parseChannelString(selector, ['LINE', 'AUX', 'FX' /* 'FXRETURN' ??? */, 'MAIN']),
        presetTargetSlave: 0,
        presetFile: 'presets/channel/' + chanFile
      }
    ))
  }

  /**
   * Mute a given channel
   */
  mute(selector: ChannelSelector) {
    this.setMute(selector, true)
  }

  /**
   * Unmute a given channel
   */
  unmute(selector: ChannelSelector) {
    this.setMute(selector, false)
  }

  /**
   * Toggle the mute status of a channel
   */
  toggleMute(selector: ChannelSelector) {
    this.setMute(selector, 'toggle')
  }

  /**
   * Get mute status of a channel
   */
  getMute(selector: ChannelSelector) {
    const state = this.state.get(this._getMuteTargetString(selector))
    if (state === null) return null

    // AUX and FX mixes have inverted states
    return selector.mixType ? !state : state
  }

  /**
   * Set the mute status of a channel
   */
  setMute(selector: ChannelSelector, status: boolean | 'toggle') {
    const targetString = this._getMuteTargetString(selector)

    // AUX and FX mixes have inverted states
    const shouldInvert = !!selector.mixType

    let state: boolean = (status === 'toggle') ? !this.state.get(targetString) : status
    if (status !== 'toggle' && shouldInvert) state = !state

    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(targetString + '\x00\x00\x00'),
        toBoolean(state)
      ])
    )
  }

  /**
   * @private
   */
  private _getMuteTargetString(selector: ChannelSelector) {
    let targetString = parseChannelString(selector)

    if (selector.mixType) {
      targetString += `/assign_${selector.mixType.toLowerCase()}${selector.mixNumber}`
    } else {
      targetString += '/mute'
    }

    return targetString
  }

  /**
   * Toggle the solo status of a channel
   */
  toggleSolo(selector: ChannelSelector) {
    this.setSolo(selector, 'toggle')
  }

  /**
   * Get solo status of a channel
   */
  getSolo(selector: ChannelSelector) {
    const state = this.state.get(this._getSoloTargetString(selector))
    if (state === null) return null
    return state
  }

  /**
   * Set the solo status of a channel
   */
  setSolo(selector: ChannelSelector, status: boolean | 'toggle') {
    const targetString = this._getSoloTargetString(selector)

    // AUX and FX mixes have inverted states
    const shouldInvert = !!selector.mixType

    let state: boolean = (status === 'toggle') ? !this.state.get(targetString) : status
    if (status !== 'toggle' && shouldInvert) state = !state

    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(targetString + '\x00\x00\x00'),
        toBoolean(state)
      ])
    )
  }

  /**
   * @private
   */
  private _getSoloTargetString(selector: ChannelSelector) {
    let targetString = parseChannelString(selector)
    targetString += '/solo'
    return targetString
  }

  setColor(selector: ChannelSelector, hex: string, alpha: number = 0xFF) {
    this._sendPacket(
      MessageCode.ParamChars,
      Buffer.concat([
        Buffer.from(`${parseChannelString(selector)}/color\x00\x00\x00`),
        Buffer.from(hex, 'hex'),
        Buffer.from([alpha])
      ])
    )
  }

  setColour(...args: Parameters<this['setColor']>) {
    return this.setColor.apply(this, args)
  }

  getColor(selector: ChannelSelector) {
    return this.state.get(`${parseChannelString(selector)}/color`)
  }

  getColour(...args: Parameters<this['getColor']>) {
    return this.getColor.apply(this, args)
  }

  /**
   * For a mono channel, the pan value is the pan value from 0 (hard left) to 100 (hard right)
   * For a stereo channel, the pan value is the width from 0 to 100 (stereo)
   */
  setPan(selector: ChannelSelector, pan: number) {
    /*
    When channels are grouped
    link = 1
    panlinkstate = 1

    initiator
    linkmaster = 1
    */

    let channelString = parseChannelString(selector)

    const isStereo = this.state.get(channelString + '/link')

    if (selector.mixType) {
      switch (selector.mixType) {
        case 'AUX':
        {
          const odd = (selector.mixNumber - 1) | 1
          channelString += `/aux${odd}${odd + 1}_`
          if (this.state.get(`aux.ch${selector.mixNumber}.link`)) {
            channelString += isStereo ? 'stpan' : 'pan'
          } else {
            // No need to pan a mono aux
            return
          }
          break
        }
        default:
          throw new Error('Unexpected mix type')
      }
    } else {
      channelString += '/' + (isStereo ? 'stereopan' : 'pan')
    }

    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(`${channelString}\x00\x00\x00`),
        toFloat(pan / 100)
      ])
    )
  }

  /**
   * @internal By original nature, only an odd numbered channel is targeted (& ~1)
   */
  setLink(selector: ChannelSelector, link: boolean) {
    this._sendPacket(
      MessageCode.ParamValue,
      Buffer.concat([
        Buffer.from(`${parseChannelString(selector)}/link\x00\x00\x00`),
        toBoolean(link)
      ])
    )
  }

  private _getLevelString(selector: ChannelSelector) {
    let targetString = parseChannelString(selector)

    if (selector.mixType) {
      switch (selector.mixType) {
        case 'AUX':
          targetString += `/${Channel[selector.mixType]}${selector.mixNumber}`
          break
        case 'FX':
          targetString += `/FX${String.fromCharCode(0x40 + selector.mixNumber)}`
          break
        default:
          throw new Error('Unexpected mix type')
      }
    } else {
      targetString += '/volume'
    }

    return targetString
  }

  getLevel(selector: ChannelSelector) {
    return this.state.get(this._getLevelString(selector))
  }

  /**
   * @internal Send a level command to the target
   * targetLevel - [0, 100]
   */
  private _setLevel(this: Client, selector: ChannelSelector, targetLevel, duration: number = 0): Promise<null> {
    const targetString = this._getLevelString(selector)

    console.log('call set level', targetString, targetLevel)

    const assertReturn = () => {
      // Additional time to wait for response
      return new Promise<null>((resolve) => {
        // 0ms timeout - queue event loop
        setTimeout(() => {
          this.state.set(targetString, targetLevel)
          resolve(null)
        }, 0)
      })
    }

    const set = (level) => {
      this._sendPacket(
        MessageCode.ParamValue,
        Buffer.concat([
          Buffer.from(`${targetString}\x00\x00\x00`),
          toFloat(level / 100)
        ])
      )
    }

    if (!duration) {
      set(targetLevel)
      return assertReturn()
    }

    const currentLevel = this.getLevel(selector) ?? 0

    // Don't do anything if we already are on the same level
    if (currentLevel === targetLevel) {
      return assertReturn()
    }

    return new Promise((resolve) => {
      transitionValue(
        currentLevel,
        targetLevel, duration,
        (v) => set(v),
        async () => {
          resolve(await assertReturn())
        }

      )
    })
  }

  /**
   * Set volume (decibels)
   *
   * @param channel
   * @param level range: -84 dB to 10 dB
   */
  async setChannelVolumeLogarithmic(selector: ChannelSelector, decibel: number, duration?: number) {
    return this._setLevel(selector, logVolumeToLinear(decibel), duration)
  }

  /**
   * Set volume (pseudo intensity)
   *
   * @description Sound is difficult, so this function attempts to provide a "what-you-see-is-what-you-get" interface to control the volume levels.
   *              `100` Sets the fader to the top (aka +10 dB)
   *              `72` Sets the fader to unity (aka 0 dB) or a value close enough
   *              `0` Sets the fader to the bottom (aka -84 dB)
   * @see http://www.sengpielaudio.com/calculator-levelchange.htm
   */
  async setChannelVolumeLinear(selector: ChannelSelector, linearLevel: number, duration?: number) {
    return this._setLevel(selector, linearLevel, duration)
  }

  /**
   * Look at metering data and adjust channel fader so that the level is of a certain loudness
   * NOTE: This is not perceived loudness. Not very practical, but useful in a pinch?
   *
   * @param channel
   * @param level
   * @param duration
   */
  async normaliseChannelTo(channel, level, duration?: number) {
    // TODO:
  }
}

export default Client
