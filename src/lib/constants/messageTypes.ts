/* eslint no-unused-vars: "off" */

export enum MESSAGETYPES {
    // KeepAlive
    KeepAlive = 'KA',
    
    Hello = 'UM',
    
    // Message
    JSON = 'JM',
    
    // ParamValue
    Setting = 'PV',
    
    // ParamStrList
    DeviceList = 'PL',
    
    // FileRequest
    FileResource = 'FR',
    
    // FileData
    FileResource2 = 'FD',

    // BZ-Message
    ZLIB = 'ZB',

    // Binary
    Unknown1 = 'BO',

    /**
     * Compressed content
     */
    Unknown2 = 'CK',
    Chunk = 'CK',

    /**
     * Mute? mt64?
     */
    // Meter8
    Unknown3 = 'MB',

    /**
     * Linear position of faders
     * Only message sent for main fader changes
     */
    // Meter16
    FaderPosition = 'MS'
}
