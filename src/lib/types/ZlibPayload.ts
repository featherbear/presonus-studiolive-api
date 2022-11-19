// As of 20th November 2021
// https://github.com/featherbear/presonus-studiolive-api/blob/80e67e6bab77356f6c0898c98890515b0a5464b8/zlib.parsed

/* eslint-disable */

import type { Children, Values, States, Ranges, Strings } from './ZlibPayloadHelper'
import type { GenericChildren, GenericValues, GenericRanges } from './ZlibPayloadHelper'
export interface ZlibPayload {
    id: string;
    children: ZlibPayloadChildren;
    shared: Shared;
}
export default ZlibPayload

export interface ZlibPayloadChildren {
    global: Global;
    advancedscenefilters: Filters;
    projectfilters: Filters;
    permissions: Permissions;
    presets: Presets;
    channelfilters: Filters;
    mastersection: MasterSection;
    mutegroup: MuteGroup;
    outputpatchrouter: OutputPatchRouter;
    networksetup: NetworkSetup;
    sdrecorder: SDRecorder;
    stageboxsetup: StageboxSetup;
    earmixsetup: EarmixSetup;
    softpower: Softpower;
    users: Users;
    line: Line;
    return: Return;
    talkback: Talkback;
    signalgen: SignalGen;
    aux: Aux;
    fxbus: FXBus;
    fxreturn: FXReturn;
    main: Main;
    geq: Geq;
    filtergroup: FilterGroup;
    autofiltergroup: FilterGroup;
    fx: FX;
}




export type Filters = GenericValues<number>

export type FilterGroup = GenericChildren<Values<FilterGroupValues>>

export interface FilterGroupValues {
    name: string;
    groupnum: string;
    solo: number;
    iconid: string;
    mute: number;
    mute_aux1: number;
    mute_aux2: number;
    mute_aux3: number;
    mute_aux4: number;
    mute_aux5: number;
    mute_aux6: number;
    mute_aux7: number;
    mute_aux8: number;
    mute_aux9: number;
    mute_aux10: number;
    mute_aux11: number;
    mute_aux12: number;
    mute_aux13: number;
    mute_aux14: number;
    mute_aux15: number;
    mute_aux16: number;
    mute_aux17: number;
    mute_aux18: number;
    mute_aux19: number;
    mute_aux20: number;
    mute_aux21: number;
    mute_aux22: number;
    mute_aux23: number;
    mute_aux24: number;
    mute_aux25: number;
    mute_aux26: number;
    mute_aux27: number;
    mute_aux28: number;
    mute_aux29: number;
    mute_aux30: number;
    mute_aux31: number;
    mute_aux32: number;
    mute_fx1: number;
    mute_fx2: number;
    mute_fx3: number;
    mute_fx4: number;
    mute_fx5: number;
    mute_fx6: number;
    mute_fx7: number;
    mute_fx8: number;
    volume: number;
    aux1: number;
    aux2: number;
    aux3: number;
    aux4: number;
    aux5: number;
    aux6: number;
    aux7: number;
    aux8: number;
    aux9: number;
    aux10: number;
    aux11: number;
    aux12: number;
    aux13: number;
    aux14: number;
    aux15: number;
    aux16: number;
    aux17: number;
    aux18: number;
    aux19: number;
    aux20: number;
    aux21: number;
    aux22: number;
    aux23: number;
    aux24: number;
    aux25: number;
    aux26: number;
    aux27: number;
    aux28: number;
    aux29: number;
    aux30: number;
    aux31: number;
    aux32: number;
    fx1: number;
    fx2: number;
    fx3: number;
    fx4: number;
    fx5: number;
    fx6: number;
    fx7: number;
    fx8: number;
    line1: number;
    line2: number;
    line3: number;
    line4: number;
    line5: number;
    line6: number;
    line7: number;
    line8: number;
    line9: number;
    line10: number;
    line11: number;
    line12: number;
    line13: number;
    line14: number;
    line15: number;
    line16: number;
    line17: number;
    line18: number;
    line19: number;
    line20: number;
    line21: number;
    line22: number;
    line23: number;
    line24: number;
    line25: number;
    line26: number;
    line27: number;
    line28: number;
    line29: number;
    line30: number;
    line31: number;
    line32: number;
    line33: number;
    line34: number;
    line35: number;
    line36: number;
    line37: number;
    line38: number;
    line39: number;
    line40: number;
    line41: number;
    line42: number;
    line43: number;
    line44: number;
    line45: number;
    line46: number;
    line47: number;
    line48: number;
    line49: number;
    line50: number;
    line51: number;
    line52: number;
    line53: number;
    line54: number;
    line55: number;
    line56: number;
    line57: number;
    line58: number;
    line59: number;
    line60: number;
    line61: number;
    line62: number;
    line63: number;
    line64: number;
    fxreturn1: number;
    fxreturn2: number;
    fxreturn3: number;
    fxreturn4: number;
    fxreturn5: number;
    fxreturn6: number;
    fxreturn7: number;
    fxreturn8: number;
    return1: number;
    return2: number;
    return3: number;
    return4: number;
}

export type Aux = GenericChildren<Values<AuxChildValues>
    & Strings<AuxChildStrings>
    & GenericRanges
    & States<AuxChildStates>
    & Children<AuxChildChildren>>

export interface AuxChildChildren {
    opt: Opt;
    eq: {
        classId: string;
        values: { [key: string]: number };
    };
    limit: Limit;
    
    filter?: Filter;
    comp: AuxChildChildrenComp;
    linkoptions: LinkOptions;
}

export interface AuxChildChildrenComp {
    classId: {
        The870D04F7212E4F9CAdbb39A97216433F: '{870D04F7-212E-4F9C-ADBB-39A97216433F}'
    },
    values: { [key: string]: number };
}
export type Filter = Values<{ hpf: number; }>
export type Limit = Values<{
    limiteron: number;
    threshold: number;
    reduction: number;
}>

export type LinkOptions = Values<{
    ch_gain: number;
    pan: number;
    fader: number;
    dyn: number;
    ch_name: number;
    ins_fx: number;
}>

export type Opt =
    Values<{
        eqmodel: number;
        compmodel: number;
        swapcompeq: number;
    }> & Strings<{
        eqmodel: number;
        compmodel: number;
    }>
export interface Range<UnitSource = RangeUnitSource> {
    min: number;
    max: number;
    def: number;
    units?: UnitSource;
}

export enum RangeUnitSource {
    AnalogSource = 'analog_source',
    AVBnum = 'avbnum',
    DigitalSource = 'digital_source',
    USBnum = 'usbnum',
}
export interface AuxChildStates {
    monolevel: number;
    centerdiv: number;
    adc_src: number;
    usb_src: number;
}

export interface AuxChildStrings {
    auxpremode: number;
    busmode: number;
    bussrc: number;
}

export interface AuxChildValues {
    chnum: string;
    name: string;
    username: string;
    color: number;
    select: number;
    solo?: number;
    volume: number;
    mute: number;
    pan: number;
    stereopan: number;
    panlinkstate: number;
    link: number;
    linkmaster: number;
    dawpostdsp: number;
    memab: number;
    iconid: string;
    rta_active: number;
    rta_pre: number;
    assign_aux1: number;
    assign_aux2: number;
    assign_aux3: number;
    assign_aux4: number;
    assign_aux5: number;
    assign_aux6: number;
    assign_aux7: number;
    assign_aux8: number;
    assign_aux9: number;
    assign_aux10: number;
    assign_aux11: number;
    assign_aux12: number;
    assign_aux13: number;
    assign_aux14: number;
    assign_aux15: number;
    assign_aux16: number;
    assign_aux17: number;
    assign_aux18: number;
    assign_aux19: number;
    assign_aux20: number;
    assign_aux21: number;
    assign_aux22: number;
    assign_aux23: number;
    assign_aux24: number;
    assign_aux25: number;
    assign_aux26: number;
    assign_aux27: number;
    assign_aux28: number;
    assign_aux29: number;
    assign_aux30: number;
    assign_aux31: number;
    assign_aux32: number;
    aux1: number;
    aux2: number;
    aux3: number;
    aux4: number;
    aux5: number;
    aux6: number;
    aux7: number;
    aux8: number;
    aux9: number;
    aux10: number;
    aux11: number;
    aux12: number;
    aux13: number;
    aux14: number;
    aux15: number;
    aux16: number;
    aux17: number;
    aux18: number;
    aux19: number;
    aux20: number;
    aux21: number;
    aux22: number;
    aux23: number;
    aux24: number;
    aux25: number;
    aux26: number;
    aux27: number;
    aux28: number;
    aux29: number;
    aux30: number;
    aux31: number;
    aux32: number;
    aux12_pan: number;
    aux34_pan: number;
    aux56_pan: number;
    aux78_pan: number;
    aux910_pan: number;
    aux1112_pan: number;
    aux1314_pan: number;
    aux1516_pan: number;
    aux1718_pan: number;
    aux1920_pan: number;
    aux2122_pan: number;
    aux2324_pan: number;
    aux2526_pan: number;
    aux2728_pan: number;
    aux2930_pan: number;
    aux3132_pan: number;
    aux12_stpan: number;
    aux34_stpan: number;
    aux56_stpan: number;
    aux78_stpan: number;
    aux910_stpan: number;
    aux1112_stpan: number;
    aux1314_stpan: number;
    aux1516_stpan: number;
    aux1718_stpan: number;
    aux1920_stpan: number;
    aux2122_stpan: number;
    aux2324_stpan: number;
    aux2526_stpan: number;
    aux2728_stpan: number;
    aux2930_stpan: number;
    aux3132_stpan: number;
    mono: number;
    monolevel: number;
    centerdiv: number;
    insertslot: number;
    insertprepost: number;
    adc_src?: number;
    avb_src: number;
    usb_src: number;
    sd_src: number;
    adc_src2?: number;
    avb_src2: number;
    usb_src2: number;
    sd_src2: number;
    auxpremode?: number;
    busmode?: number;
    busdelay?: number;
    lr_assign?: number;
    bussrc?: number;
    lr?: number;
    sub1?: number;
    sub2?: number;
    sub3?: number;
    sub4?: number;
    assign_fx1?: number;
    assign_fx2?: number;
    assign_fx3?: number;
    assign_fx4?: number;
    assign_fx5?: number;
    assign_fx6?: number;
    assign_fx7?: number;
    assign_fx8?: number;
    FXA?: number;
    FXB?: number;
    FXC?: number;
    FXD?: number;
    FXE?: number;
    FXF?: number;
    FXG?: number;
    FXH?: number;
    inputsrc?: number;
    inputsrc_preview?: number;
    delay?: number;
    flexassignflags?: number;
    preampactive?: number;
    remotepreactive?: number;
    remotepreperm?: number;
    diggainactive?: number;
    gaincompavail?: number;
    '48v'?: number;
    polarity?: number;
    preampgain?: number;
    digitalgain?: number;
    preampmode?: number;
    '10db_boost'?: number;
    clip?: number;
    gatekeysrc?: number;
    compkeysrc?: number;
    digsendsrc?: number;
    gaincomp?: number;
    trim?: number;
}

export type EarmixSetup = Values<{
    mixerlist: number;
    selected_name: string;
    identify: number;
    apply: number;
    apply_all: number;
    inputroute_1_8: number;
    inputroute_9_16: number;
}> & Strings<{ mixerlist: any[]; }>

export type FX =
    GenericChildren<
        Values<{
            type: number;
            pluginstate: string;
        }>
        & Strings<{
            type: number;
        }>
        & Children<{
            plugin: Plugin;
        }>
    >
export type Plugin =
    Values<{
        type: number;
        predelay: number;
        diffusion?: number;
        reflection: number;
        lpf: number;
        lfdamp_freq: number;
        lfdamp_gain: number;
        size?: number;
    }> & { classId: string; }


export type FXBus = GenericChildren<
    Values<{
        chnum: string;
        name: string;
        username: string;
        color: number;
        select: number;
        volume: number;
        mute: number;
        pan: number;
        stereopan: number;
        panlinkstate: number;
        link: number;
        linkmaster: number;
        memab: number;
        iconid: string;
        rta_active: number;
        rta_pre: number;
        auxpremode: number;
        busmode: number;
        busdelay: number;
    }>
    & Strings<{
        auxpremode: number;
        busmode: number;
    }>
    & States<{
        link: number;
    }>
    & Children<FXBusChildren>
>

export interface FXBusChildren {
    opt: Opt;
    eq: FluffyEq;
    limit?: Limit;
    comp: AuxChildChildrenComp;
}

export interface FluffyEq {
    classId: EqClassID;
    values: { [key: string]: number };
}

export enum EqClassID {
    A0A8A06814F04B04Bb6FAf8329D0E8Ee = '{A0A8A068-14F0-4B04-BB6F-AF8329D0E8EE}',
}


export interface FXReturn {
    children: { [key: string]: FxreturnChild };
}

export interface FxreturnChild {
    values: AuxChildValues;
    strings: StickyStrings;
    ranges: PurpleRanges;
    states: { [key: string]: number };
    children: FXBusChildren;
}

export interface PurpleRanges {
    adc_src?: Range;
    avb_src: Range;
    usb_src: Range;
    sd_src: Range;
    adc_src2?: Range;
    avb_src2: Range;
    usb_src2: Range;
    sd_src2: Range;
    inputsrc?: Range;
    preampgain?: PreampGain;
}

export interface PreampGain extends Range<PreampGainUnits> {
    min: number;
    max: number;
    def: number;
    units: PreampGainUnits;
    curve: Curve;
    mid: number;
}

export enum Curve {
    Linear = 'linear',
}

export enum PreampGainUnits {
    Gain0 = 'gain.0',
}

export interface StickyStrings {
    inputsrc: number;
}

export type Geq = GenericChildren<
    GenericValues<number>
    & Strings<{
        source: number;
    }>
    & Ranges<{
        source: Range;
    }>
>

export type Global =
    Values<GlobalValues>
    & Strings<{
        sd_assignable_source: string[];
    }>

export interface GlobalValues {
    identify: number;
    stagebox_mode: number;
    dcamode: number;
    panmode: number;
    mixer_name: string;
    devicename: string;
    mixer_version: string;
    mixer_version_date: string;
    mixer_serial: string;
    registered_user: string;
    progress_text1: string;
    progress_text2: string;
    progress_percent: number;
    samplerate: number;
    showPeakHold: number;
    ledbrightness: number;
    scribblebrightness: number;
    lcdbrightness: number;
    auxmutemode: number;
    rta_active: number;
    rta_pre: number;
    sd_assignable_source: number;
    usb_assignable_source: number;
    fltrname: number;
    fltrmute: number;
    fltrfx: number;
    fltreqdynins: number;
    fltreqdynouts: number;
    fltraux: number;
    fltrassign: number;
    fltrpreamps: number;
    fltrfader: number;
    fltrgeq: number;
    fltrdcagrp: number;
    fltr48v: number;
    fltrmutegroups: number;
    fltruser: number;
    fltrpatch: number;
    scene_safe_ins_1_32: number;
    scene_safe_ins_33_64: number;
    soft_power_logout: number;
    last_logged_in_profile_index: number;
    bus_level_limit: number;
    if_mode: number;
}

export type Line = Children<{
    ch1: LineChild;
    ch2: LineChild;
    ch3: LineChild;
    ch4: LineChild;
    ch5: LineChild;
    ch6: LineChild;
    ch7: LineChild;
    ch8: LineChild;
    ch9: LineChild;
    ch10: LineChild;
    ch11: LineChild;
    ch12: LineChild;
    ch13: LineChild;
    ch14: LineChild;
    ch15: LineChild;
    ch16: LineChild;
}>

export type LineChild =
    Values<AuxChildValues>
    & Strings<IndecentStrings>
    & Ranges<PurpleRanges>
    & Children<IndigoChildren>

export interface IndigoChildren {
    opt: Opt;
    eq: FluffyEq;
    limit: Limit;

    filter: Filter;
    gate: Gate;
    comp: AuxChildChildrenComp | FluffyComp;
    linkoptions: LinkOptions;
}

export interface FluffyComp {
    classId: string;
    values: CompValues;
}

export interface CompValues {
    on: number;
    mode: number;
    gain: number;
    peak: number;
    reduction: number;
    keyfilter: number;
    keylisten: number;
}

export interface Gate {
    values: GateValues;
}

export interface GateValues {
    on: number;
    keylisten: number;
    expander: number;
    keyfilter: number;
    threshold: number;
    range: number;
    attack: number;
    release: number;
    ratio: number;
    reduction: number;
}

export interface IndecentStrings {
    inputsrc: number;
    gatekeysrc: number;
    compkeysrc: number;
}



export interface Main {
    children: MainChildren;
}

export interface MainChildren {
    ch1: FluffyCh1;
}

export interface FluffyCh1 {
    values: AuxChildValues;
    strings: AuxChildStrings;
    ranges: { [key: string]: Range };
    states: { [key: string]: number };
    children: AuxChildChildren;
}

export interface MasterSection {
    values: { [key: string]: number };
    strings: MastersectionStrings;
    states: MastersectionStates;
}

export interface MastersectionStates {
    anysolo: number;
    solo_selects: number;
}

export interface MastersectionStrings {
    mon_list: string[];
    phones_list: string[];
}

export type MuteGroup = Values<MutegroupValues>
export interface MutegroupValues {
    allon: number;
    alloff: number;
    mutegroup1: number;
    mutegroup2: number;
    mutegroup3: number;
    mutegroup4: number;
    mutegroup5: number;
    mutegroup6: number;
    mutegroup7: number;
    mutegroup8: number;
    mutegroup1username: string;
    mutegroup2username: string;
    mutegroup3username: string;
    mutegroup4username: string;
    mutegroup5username: string;
    mutegroup6username: string;
    mutegroup7username: string;
    mutegroup8username: string;
    mutegroup1mutes: string;
    mutegroup2mutes: string;
    mutegroup3mutes: string;
    mutegroup4mutes: string;
    mutegroup5mutes: string;
    mutegroup6mutes: string;
    mutegroup7mutes: string;
    mutegroup8mutes: string;
}

export type NetworkSetup =
    Values<NetworksetupValues>
    & Strings<{
        networklist: number;
    }>
export interface NetworksetupValues {
    ipaddress: string;
    subnet: string;
    gateway: string;
    assignmode: number;
    refresh: number;
    setupactivity: number;
    status: string;
    scan: number;
    networklist: number;
    signalstrength: number;
}

export type OutputPatchRouter = GenericValues<number> & GenericRanges

export type Permissions = Values<{
    device_list: number;
    mix_permissions: number;
    access_code: string;
    wheel_only: number;
    rename: number;
    channel_source: number;
    preamps: number;
    assigns: number;
    scenes: number;
    mute_groups: number;
    channel_type: number;
    eq_dyn: number;
    geq: number;
    fx: number;
    groups: number;
}> & Strings<{
    device_list: any[];
    mix_permissions: string[];
}>

export type Presets = Values<{
    isProjectLoaded: number;
    isSceneLoaded: number;
    loaded_scene_name: string;
    loaded_scene_title: string;
    loading_scene: number;
    loaded_project_name: string;
    loaded_project_title: string;
    diskusage: number;
    storedisabled: number;
}>
export type Return = Children<{
    ch1: Values<AuxChildValues>
    & Strings<StickyStrings>
    & Ranges<PurpleRanges>
    & States<{
        panlinkstate: number;
        link: number;
    }>
    & Children<FXBusChildren>
}>
export type SDRecorder = Values<{
    soundcheckMode: number;
    allDigitalInput: number;
    armAll: number;
    armSelect: number;
    status: string;
}> & Children<{
    transport: Transport;
    session: Session;
    sdcard: Sdcard;
}>

export type Sdcard = Values<{
    card_type: number;
    card_mounted: number;
    card_capcity: string;
    volume_label: string;
    speed_test: number;
    performance_speed: string;
    performance_tracks: string;
    format_type: number;
    do_format: number;
    format_error: number;
}>

export type Session = Values<{
    artist: string;
    performance: string;
    location: string;
    artistlist: number;
    performancelist: number;
    locationlist: number;
    folder_hierarchy: number;
    title: string;
    path: string;
    new: number;
    load: number;
    loadmix: number;
    close: number;
    active: number;
    lockSession: number;
    loadStatus: number;
}> & Strings<{
    artistlist: number;
    performancelist: number;
    locationlist: number;
}>
export type Transport = Values<
    {
        play: number;
        stop: number;
        record: number;
        returnToZero: number;
        fastForward: number;
        rewind: number;
        recordLock: number;
        locate_pos: number;
        currentRecordTime: string;
        jog: number;
        running: number;
        remainingTime: string;
        diskSpaceWarning: number;
        fileSizeWarning: number;
        performanceWarning: number;
        record_error: string;
        lockTransport: number;
    }>
export type SignalGen = Values<{
    type: number;
    freq: number;
    level: number;
}>
export type Softpower = Values<{
    initiateSoftPower: number;
    softPowerStage: number;
    softPowerProgress: number;
}>
export type StageboxSetup =
    Values<StageboxsetupValues>
    & Strings<StageboxsetupStrings>
    & States<{ apply: number; }>
export interface StageboxsetupStrings {
    mixerlist: any[];
    stagebox_mode: number;
    preamp_control: string[];
    avb_src: string[];
    avb_src2: string[];
    avb_src_1_8: string[];
    avb_src_9_16: string[];
    avb_src_17_24: string[];
    avb_src_25_32: string[];
    avb_src_33_40: string[];
    avb_src_41_48: string[];
    avb_src_49_56: string[];
    avb_src_57_64: string[];
}

export interface StageboxsetupValues {
    mixerlist: number;
    selected_name: string;
    stagebox_mode: number;
    preamp_control: number;
    avb_src: number;
    avb_src2: number;
    auto_route: number;
    identify: number;
    apply: number;
    preamp_lock: number;
    stagebox_type: number;
    connect_status: number;
    latency_menu: number;
    latency: number;
    apply_latency: number;
    avb_src_1_8: number;
    avb_src_9_16: number;
    avb_src_17_24: number;
    avb_src_25_32: number;
    avb_src_33_40: number;
    avb_src_41_48: number;
    avb_src_49_56: number;
    avb_src_57_64: number;
    avb_clocksrc: number;
    avb_clockstatus: number;
}

export interface Talkback {
    children: TalkbackChildren;
}

export interface TalkbackChildren {
    ch1: StickyCh1;
}

export interface StickyCh1 {
    values: AuxChildValues;
    strings: IndecentStrings;
    ranges: PurpleRanges;
    states: StickyStates;
    children: IndecentChildren;
}

export interface IndecentChildren {
    filter: Filter;
}

export interface StickyStates {
    link: number;
    dawpostdsp: number;
    usb_src: number;
    sd_src: number;
}

export interface Users {
}

export interface Shared {
    strings: Array<string[]>;
}
