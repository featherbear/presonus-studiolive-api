import logging
import socket

log = logging.getLogger('udp_server')
import os

def udp_server(host='0.0.0.0', port=52703):
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    log.info("Listening on udp %s:%s" % (host, port))
    s.bind((host, port))
    while True:
        (data, addr) = s.recvfrom(128*1024)
        yield data

data = {}

import struct

for x in udp_server():
  head, length, code, conn, levl, SPACER, data = x[:4], x[4:6], x[6:8], x[8:12], x[12:16], x[16:20], x[20:]
  if levl != b'levl': continue
  os.system('cls')
  assert(head == b"UC\x00\x01")

  print("Length unpack", struct.unpack("<H", length)[0], "?", len(x))
  print("Message code", code)
  print("Connection bits", conn)

  
  
  print("---")
  
  # x = x[16:-1]
  
  # for i in range(0, 32*2 * 8, 2):
  #   val = struct.unpack("<H",data[i:i+2])[0]
  #   if (val): print("Input for Channel", str(int(i/2 + 1)).zfill(3) , str(val).zfill(5))
  z = len(data)
  for i in range(0, z-1, 2):
    val = struct.unpack("<H",data[i:i+2])[0]
    if not val: val = "-----"
    print(str(int(i/2 + 1)).zfill(3), str(val).zfill(5), end=" ")
  print()
 
 
"""
# for channel 24
looks like chain levels

50 -> | 130 | -> | 258 | -> | 322 | -> | 386 |

"""


# 201 -> Main out