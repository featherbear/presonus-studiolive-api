[UC Surface]: https://www.presonus.com/products/UC-Surface

# PreSonus StudioLive III Network Control Protocol Research

---

# General

## Packet Headers

All packets start with the four bytes `\x55\x43\x00\x01` (UC..)

## Payload Types

There are different formats of payloads, identified by a two byte preamble preceding the payload data

|Code |Description|
|:---:|:--------:|
|KA|KeepAlive|
|UM|Hello|
|JM|JSON|
|PV|Setting|
|PL|Settings 2|
|FR|FileResource|
|FD|FileResource 2|
|BO|?????????|
|CK|Compressed Data ??????|

## Payload Packing

In most situations, the packet is sent as follows

|Header|Payload Size|Payload Type|Payload Data|
|:----:|:----------:|:----------:|:----------:|
|`\x55\x43\x00\x01`|2-byte LE|2-byte code|data|

Note: `Payload Size = length(Payload Type) + length(Payload Data)`

## C-Bytes

There are four bytes that appear after the payload type in the payload data.
The first and third positions have some byte value [`0x6a`, `0x68`, `0x65`], with the other positions being NULL.

i.e. `68 00 65 00`, or `6a 00 65 00`

I will refer to this group of four bytes as **C-Bytes** (custom bytes).  
The first byte will be known as **C-Byte A** and the third as **C-Byte B**

They seem to be used for signalling and matching responses to requests.  
_i.e (hypothetically) If a message is sent with a signal value of 'A', a response will be sent containing a signal value of 'A' so that the response can be matched with the request._

For most cases it looks like they're not too important to keep synchronised - But as I keep researching and developing this API, I might find the need to actually implement proper request matching


# Hello

> The first packet that gets sent to the console

```
55 43 00 01 08 00 55 4d 00 00 65 00 15 fa   UC....UM..e...
```

|Bytes|Description|Note|
|:---:|:---------:|:---|
|0-3|Header||
|4-5|Payload Size||
|6-7|Payload Type|`UM`|
|8-11|C-Bytes||
|12->13|Payload Data|`TCP Window Size + 1` ???|

# Subscribe

```
55 43 00 01 fe 00 4a 4d 6a 00 65 00 f4 00 00 00   UC....JMj.e.....
7b 22 69 64 22 3a 20 22 53 75 62 73 63 72 69 62   {"id": "Subscrib
65 22 2c 22 63 6c 69 65 6e 74 4e 61 6d 65 22 3a   e","clientName":
20 22 55 6e 69 76 65 72 73 61 6c 20 43 6f 6e 74    "Universal Cont
72 6f 6c 22 2c 22 63 6c 69 65 6e 74 49 6e 74 65   rol","clientInte
72 6e 61 6c 4e 61 6d 65 22 3a 20 22 75 63 61 70   rnalName": "ucap
70 22 2c 22 63 6c 69 65 6e 74 54 79 70 65 22 3a   p","clientType":
20 22 50 43 22 2c 22 63 6c 69 65 6e 74 44 65 73    "PC","clientDes
63 72 69 70 74 69 6f 6e 22 3a 20 22 46 45 41 54   cription": "FEAT
48 45 52 4e 45 54 2d 50 43 22 2c 22 63 6c 69 65   HERNET-PC","clie
6e 74 49 64 65 6e 74 69 66 69 65 72 22 3a 20 22   ntIdentifier": "
46 45 41 54 48 45 52 4e 45 54 2d 50 43 22 2c 22   FEATHERNET-PC","
63 6c 69 65 6e 74 4f 70 74 69 6f 6e 73 22 3a 20   clientOptions": 
22 70 65 72 6d 20 75 73 65 72 73 20 6c 65 76 6c   "perm users levl
20 72 65 64 75 20 72 74 61 6e 22 2c 22 63 6c 69    redu rtan","cli
65 6e 74 45 6e 63 6f 64 69 6e 67 22 3a 20 32 33   entEncoding": 23
31 30 36 7d                                       106}
```

|Bytes|Description|Note|
|:---:|:---------:|:---|
|0-3|Header||
|4-5|Payload Size||
|6-7|Payload Type|`JM`|
|8->11|C-Bytes|`6a 00 65 00`|
|12-15|JSON Size|4-byte LE|
|16->?|JSON Data||

```
55 43 00 01 1d 00 46 52 6a 00 65 00 01 00 4c 69   UC....FRj.e...Li
73 74 70 72 65 73 65 74 73 2f 63 68 61 6e 6e 65   stpresets/channe
6c 00 00                                          l..
```

Header + 

# Broadcast

Every **3 seconds**, the console will broadcast a UDP packet (from port `53000`) to `255.255.255.255:47809`.

## UDP Payload

```
55 43 00 01 08 cf 44 41 65 00 00 00 00 04 00 80   UC....DAe.......
48 1c 48 67 23 60 51 4f 92 4e 1e 46 91 50 51 d1   H.Hg#`QO.N.F.PQ.
53 74 75 64 69 6f 4c 69 76 65 20 32 34 52 00 41   StudioLive 24R.A
55 44 00 52 41 32 45 31 38 30 33 30 32 32 36 00   UD.RA2E18030226.
53 74 75 64 69 6f 4c 69 76 65 20 32 34 52 00      StudioLive 24R.
```

|Bytes|Description|
|:---:|:---------:|
|0-3|Header|
|4-5|Source Port (2 byte little endian)|
|6-23|???|
|24->?|Console Model*|

*Console Model: Used to identify the icon in [UC Surface]


