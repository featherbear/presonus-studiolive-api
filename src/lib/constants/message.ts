/* eslint no-unused-vars: "off" */

// https://github.com/featherbear/presonus-studiolive-api/issues/13

export enum MessageCode {
    KeepAlive = 'KA',
    
    Hello = 'UM',
    
    // JSON Message
    JSON = 'JM',
    
    /**
     * @deprecated Use ParamValue
     */
    Setting = 'PV',
    ParamValue = 'PV',
    
    ParamColor = 'PC',
    ParamString = 'PS',
    
    /**
     * @deprecated Use ParamStrList
     */
    DeviceList = 'PL',
    ParamStrList = 'PL',
    
    FileRequest = 'FR',
    
    FileData = 'FD',

    // BZ-Message
    ZLIB = 'ZB',

    // Binary Object
    Unknown1 = 'BO',

    Chunk = 'CK',

    /**
     * Assume the B means byte (8)
     */
    // Meter8
    Unknown3 = 'MB',

    /**
     * Linear position of faders
     * Only message sent for main fader changes
     * Assume the S means short (16)
     */
    // Meter16
    FaderPosition = 'MS'
}
