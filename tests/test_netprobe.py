"""Parser tests with real command output samples (run anywhere: python -m unittest)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import netprobe as n  # noqa: E402

WIN_ROUTE = """
===========================================================================
IPv4 Route Table
===========================================================================
Active Routes:
Network Destination        Netmask          Gateway       Interface  Metric
          0.0.0.0          0.0.0.0      192.168.0.1    192.168.0.101     35
          0.0.0.0          0.0.0.0       10.0.0.1         10.0.0.23     50
===========================================================================
Persistent Routes:
  None
"""

WIN_ARP = """
Interface: 192.168.0.101 --- 0x7
  Internet Address      Physical Address      Type
  192.168.0.1           02-00-5e-10-00-01     dynamic
"""

WIN_NETSTAT_E = """Interface Statistics

                           Received            Sent

Bytes                    1234567890       987654321
Unicast packets             1000000          800000
Non-unicast packets            2000             100
Discards                          0               0
Errors                            0               0
Unknown protocols                 0
"""

WIN_WLAN = """
There is 1 interface on the system:

    Name                   : Wi-Fi
    Description            : Intel(R) Wi-Fi 6 AX201 160MHz
    GUID                   : 1a2b3c4d-0000-0000-0000-000000000000
    Physical address       : aa:bb:cc:dd:ee:ff
    State                  : connected
    SSID                   : HomeNet
    BSSID                  : 11:22:33:44:55:66
    Network type           : Infrastructure
    Radio type             : 802.11ax
    Authentication         : WPA2-Personal
    Cipher                 : CCMP
    Connection mode        : Auto Connect
    Band                   : 5 GHz
    Channel                : 36
    Receive rate (Mbps)    : 866.7
    Transmit rate (Mbps)   : 866.7
    Signal                 : 90%
    Profile                : HomeNet

    Hosted network status  : Not available
"""

WIN_WLAN_DISCONNECTED = """
There is 1 interface on the system:

    Name                   : Wi-Fi
    State                  : disconnected
    Radio status           : Hardware On
"""

WIN_PING_OK = """
Pinging 1.1.1.1 with 32 bytes of data:
Reply from 1.1.1.1: bytes=32 time=35ms TTL=57

Ping statistics for 1.1.1.1:
    Packets: Sent = 1, Received = 1, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 35ms, Maximum = 35ms, Average = 35ms
"""
WIN_PING_FAST = "Reply from 192.168.0.1: bytes=32 time<1ms TTL=64\n"
WIN_PING_LOST = """
Pinging 1.1.1.1 with 32 bytes of data:
Request timed out.

Ping statistics for 1.1.1.1:
    Packets: Sent = 1, Received = 0, Lost = 1 (100% loss),
"""
WIN_PING_UNREACHABLE = "Reply from 192.168.0.101: Destination host unreachable.\n"
WIN_PING_GERMAN = "Antwort von 1.1.1.1: Bytes=32 Zeit=41ms TTL=57\n"

MAC_ROUTE = """   route to: default
destination: default
       mask: default
    gateway: 192.168.0.1
  interface: en0
      flags: <UP,GATEWAY,DONE,STATIC,PRCLONING,GLOBAL>
"""
MAC_ARP = "? (192.168.0.1) at 02:00:5e:10:00:01 on en0 ifscope [ethernet]\n"
MAC_ARP_SHORT = "? (172.20.10.1) at 06:00:5e:10:a:4 on en0 ifscope [ethernet]\n"
MAC_NETSTAT = """Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
en0        1500  <Link#6>    0a:00:5e:00:00:01   596233     0  565265454   464676     0  194461285     0
en0        1500  fe80::8:0  fe80:6::8:0        596233     -  565265454   464676     -  194461285     -
"""
MAC_PING = """PING 1.1.1.1 (1.1.1.1): 56 data bytes
64 bytes from 1.1.1.1: icmp_seq=0 ttl=55 time=378.625 ms

--- 1.1.1.1 ping statistics ---
1 packets transmitted, 1 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 378.625/378.625/378.625/0.000 ms
"""
MAC_PROFILER = """Wi-Fi:

      Interfaces:
        en0:
          Card Type: Wi-Fi  (0x14E4, 0x4387)
          Status: Connected
          Current Network Information:
            <redacted>:
              PHY Mode: 802.11n
              Channel: 6 (2GHz, 20MHz)
              Country Code: GH
              Network Type: Infrastructure
              Security: WPA2 Personal
              Signal / Noise: -35 dBm / -80 dBm
              Transmit Rate: 58
              MCS Index: 7
          Other Local Wi-Fi Networks:
"""


class TestWindows(unittest.TestCase):
    def test_route_lowest_metric(self):
        self.assertEqual(n.parse_route_print(WIN_ROUTE), ("192.168.0.1", "192.168.0.101"))

    def test_route_none(self):
        self.assertIsNone(n.parse_route_print("Active Routes:\nNone\n"))

    def test_arp(self):
        self.assertEqual(n.parse_arp(WIN_ARP), "02:00:5E:10:00:01")

    def test_netstat_e(self):
        self.assertEqual(n.parse_netstat_e(WIN_NETSTAT_E), (1234567890, 987654321))

    def test_wlan(self):
        w = n.parse_netsh_wlan(WIN_WLAN)
        self.assertEqual(w["ssid"], "HomeNet")
        self.assertEqual(w["rssi"], -55)  # 90% -> about -55 dBm
        self.assertEqual(w["channel"], "36")
        self.assertEqual(w["band"], "5 GHz")
        self.assertEqual(w["phy"], "802.11ax")
        self.assertEqual(w["tx_rate"], 866)
        self.assertEqual(w["security"], "WPA2-Personal")

    def test_wlan_disconnected(self):
        self.assertIsNone(n.parse_netsh_wlan(WIN_WLAN_DISCONNECTED))

    def test_ping(self):
        self.assertEqual(n.parse_ping_time(WIN_PING_OK), 35.0)
        self.assertEqual(n.parse_ping_time(WIN_PING_FAST), 0.5)
        self.assertEqual(n.parse_ping_time(WIN_PING_GERMAN), 41.0)

    def test_ping_failures(self):
        self.assertIsNone(n.parse_ping_time(WIN_PING_LOST))
        self.assertIsNone(n.parse_ping_time(WIN_PING_UNREACHABLE))  # a reply, but not a real echo

    def test_ping_series(self):
        out = "Reply from 1.1.1.1: bytes=32 time=30ms TTL=57\nRequest timed out.\nReply from 1.1.1.1: bytes=32 time=40ms TTL=57\n"
        self.assertEqual(n.parse_ping_times(out), [30.0, 40.0])


class TestMac(unittest.TestCase):
    def test_route(self):
        self.assertEqual(n.parse_mac_route(MAC_ROUTE), ("192.168.0.1", "en0"))

    def test_arp(self):
        self.assertEqual(n.parse_arp(MAC_ARP), "02:00:5E:10:00:01")
        self.assertEqual(n.parse_arp(MAC_ARP_SHORT), "06:00:5E:10:0A:04")  # macOS drops leading zeros

    def test_netstat(self):
        self.assertEqual(n.parse_netstat_ibn(MAC_NETSTAT), (565265454, 194461285))

    def test_ping(self):
        self.assertEqual(n.parse_ping_time(MAC_PING), 378.625)
        self.assertEqual(n.parse_ping_times(MAC_PING), [378.625])

    def test_profiler(self):
        w = n.parse_system_profiler(MAC_PROFILER)
        self.assertIsNone(w["ssid"])  # redacted by macOS
        self.assertEqual((w["rssi"], w["noise"], w["channel"], w["band"]), (-35, -80, "6", "2.4 GHz"))
        self.assertEqual(w["tx_rate"], 58)


if __name__ == "__main__":
    unittest.main()
