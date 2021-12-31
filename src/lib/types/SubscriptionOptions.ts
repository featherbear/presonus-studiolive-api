export default interface SubscriptionOptions {
    /**
     * Application name
     */
    clientName?: string

    /**
     * Application internal name
     */
    clientInternalName?: string

    /**
     * Device name
     */
    clientDescription?: string // Name

    /**
     * Device ID
     */
    clientIdentifier?: string

    /**
     * ???
     */
    clientOptions?: string
}

export interface _InternalSubscriptionOptions extends SubscriptionOptions {
    id: 'Subscribe',
    clientType: 'StudioLive API',
    clientEncoding: 23106,
}
