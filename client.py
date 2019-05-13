import PreSonusAPI

from datetime import datetime
import struct
import time
import select
import json

c = PreSonusAPI.Client("192.168.0.167", 53000)

lastKeepAlive = time.time()
z = lastKeepAlive
zz = False

with open("log.txt", "ab") as f:
    def fWrite(byteStream):
        f.write(str(datetime.now()).encode() + b"|" + byteStream)
        f.flush()
    f.write(b"---------------------------------------------------\n")
    f.flush()

    try:
        while True:
            # Data receive loop
            if select.select([c.conn], [], [], 0.5)[0]:
                data = c.recv()
                if not data[:2] == b"UC":
                    raise Exception("Payload did not start with UC")
                data = data[PreSonusAPI.Protocol.headerLength:]
                code = data[:2]
                meta = data[2:6]
                data = data[6:]

                fWrite(code + b"|" + data.replace(b"\n",
                                                  b"").replace(b"\r", b"") + b"\n")

                if (code == PreSonusAPI.Protocol.MessagePrefix.CompressedUnknown):
                    continue
                elif code == PreSonusAPI.Protocol.MessagePrefix.Setting:
                    key = data[:-7]  # 5 + 2
                    state = data[-2:]  # last 2

                    print(key.decode(),  "set to", state)

                elif code == PreSonusAPI.Protocol.MessagePrefix.UNKNOWN_REPLY:
                    continue
                elif code == PreSonusAPI.Protocol.MessagePrefix.JSON:
                    continue
                    data = json.loads(data[4:].decode())
                else:
                    prefix = PreSonusAPI.Protocol.MessagePrefix[code].encode(
                    ) if code in PreSonusAPI.Protocol.MessagePrefix else (b"?" + code + b"?")
                    print(prefix + b"|" + meta.replace(b"\x00", b".") + b"|" + data)
                print("\n")

            # Keep alive
            curTime = time.time()
            if curTime - lastKeepAlive > 1.0:
                c.send(PreSonusAPI.Protocol.MessagePrefix.KeepAlive, show=False)
                lastKeepAlive = curTime

            if curTime - z > 5 and not zz:
                zz = True
                for x in range(1, 32+1):
                    c.muteChannel(x, True)
                # sendProperty("global/identify", True)

    except Exception as e:
        print(type(e), e)


# Start Loop
c.listen()
