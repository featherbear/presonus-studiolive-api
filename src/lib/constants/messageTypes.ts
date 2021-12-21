/* eslint no-unused-vars: "off" */

export enum MESSAGETYPES {
    KeepAlive = 'KA',
    Hello = 'UM',
    JSON = 'JM',
    Setting = 'PV',
    DeviceList = 'PL',
    FileResource = 'FR',
    FileResource2 = 'FD',

    ZLIB = 'ZB',

    Unknown1 = 'BO',
    Unknown2 = 'CK', // compressed
    Unknown3 = 'MB', // mute // mt64 ?

    // More sensical value; 0x00 - 0xFF for a given channel
    // Only message sent for main fader changes
    FaderPosition = 'MS'
}
