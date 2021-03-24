/* eslint no-unused-vars: "off" */

export enum MESSAGETYPES {
    KeepAlive = 'KA',
    Hello = 'UM',
    JSON = 'JM',
    Setting = 'PV',
    DeviceList = 'PL',
    FileResource = 'FR',
    FileResource2 = 'FD',

    Unknown1 = 'BO',
    Unknown2 = 'CK', // compressed
    Unknown3 = 'MS' // fader position
}
