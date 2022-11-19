import type { LogLevel } from "bunyan"

export interface InstanceOptions {
    autoreconnect: boolean
    logLevel: LogLevel
}

export interface ConnectionAddress {
    host: string
    port?: number
}
