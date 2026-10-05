"""
The Bermuda Cocktail - Local Cloud-to-Hardware Multi-Printer Bridge
Runs on the restaurant POS counter PC (DESKTOP-FP8RQTF).

Verified Hardware Printer Mapping:
1. Posiflex:                 USB Type-B -> BAR BOT (USB002)
2. Rugtek RP327:             USB Type-B -> RP327 Printer (USB001)
3. Rugtek RP327 Kitchen KOT: Ethernet   -> 192.168.0.70:9100 / KITCHEN KOT
"""

import asyncio
import websockets
import json
import base64
import socket
import sys
import os
import time

try:
    import win32print
except ImportError:
    win32print = None

DEFAULT_CLOUD_WS_URL = "wss://bermuda-cocktail-backend.onrender.com/api/printers/ws/bridge"
LOCAL_FALLBACK_WS_URL = "ws://localhost:8000/api/printers/ws/bridge"

DEFAULT_PRINTER_MAPPING = {
    "BAR": {
        "model": "Posiflex",
        "connection": "USB Type-B",
        "windows_name": "BAR BOT",
        "port": "USB002",
        "fallback_ip": ""
    },
    "CASHIER": {
        "model": "Rugtek RP327",
        "connection": "USB Type-B",
        "windows_name": "RP327 Printer",
        "port": "USB001",
        "fallback_ip": ""
    },
    "KITCHEN": {
        "model": "Rugtek RP327 – Kitchen KOT",
        "connection": "Ethernet LAN",
        "windows_name": "KITCHEN KOT",
        "ip": "192.168.0.70",
        "port": 9100
    }
}


def print_banner(server_urls):
    print("\n" + "=" * 68)
    print("   THE BERMUDA COCKTAIL - CLOUD-TO-HARDWARE MULTI-PRINTER BRIDGE")
    print("=" * 68)
    print(f" [*] Machine Hostname:      {socket.gethostname()}")
    for u in server_urls:
        print(f" [*] Server Listening:      {u}")
    print(" [*] BAR BOT (Posiflex):    USB Type-B  -> 'BAR BOT' (USB002)")
    print(" [*] Cashier (Rugtek RP327): USB Type-B  -> 'RP327 Printer' (USB001)")
    print(" [*] Kitchen (Rugtek RP327): Ethernet    -> 192.168.0.70:9100 / 'KITCHEN KOT'")
    if win32print:
        print(" [*] Windows Spooler:       ACTIVE (win32print loaded)")
    else:
        print(" [!] Windows Spooler:       NOT LOADED (run: pip install pywin32)")
    print("=" * 68)
    print(" >>> AUTO-PRINT ACTIVE: Orders will print automatically to target machines! <<<\n")


def find_windows_printer(target_name: str):
    if not win32print or not target_name:
        return None
    try:
        installed = [p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
        target_lower = target_name.strip().lower()
        for name in installed:
            if name.strip().lower() == target_lower:
                return name
        for name in installed:
            if target_lower in name.strip().lower():
                return name
    except Exception as e:
        print(f" [!] Error enumerating Windows printers: {e}")
    return None


def deliver_to_windows_printer(printer_name: str, raw_bytes: bytes, job_title: str = "Bermuda Print Job"):
    if not win32print:
        return False, "win32print module not installed (run: pip install pywin32)"
    
    actual_name = find_windows_printer(printer_name) or printer_name.strip()
    try:
        hPrinter = win32print.OpenPrinter(actual_name)
        try:
            hJob = win32print.StartDocPrinter(hPrinter, 1, (job_title, None, "RAW"))
            try:
                win32print.StartPagePrinter(hPrinter)
                win32print.WritePrinter(hPrinter, raw_bytes)
                win32print.EndPagePrinter(hPrinter)
            finally:
                win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
        return True, f"Printed successfully to Windows printer '{actual_name}'"
    except Exception as e:
        return False, f"Windows printer '{actual_name}' error: {e}"


def deliver_to_socket(ip: str, port: int, raw_bytes: bytes):
    if not ip or not ip.strip():
        return False, "IP address is empty"
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3.5)
        sock.connect((ip.strip(), int(port)))
        sock.sendall(raw_bytes)
        sock.close()
        return True, f"Sent successfully to {ip}:{port}"
    except Exception as e:
        return False, f"Socket error on {ip}:{port} -> {e}"


def dispatch_local_print(job: dict):
    target = (job.get("target") or "KITCHEN").upper()
    job_title = job.get("job_title", "Bermuda Print Job")
    windows_printer = job.get("windows_printer")
    ip = job.get("ip", "")
    port = int(job.get("port") or 9100)
    b64_data = job.get("data_b64", "")
    raw_bytes = base64.b64decode(b64_data)

    mapping = DEFAULT_PRINTER_MAPPING.get(target, {})
    default_win_name = mapping.get("windows_name", "")
    target_win_name = windows_printer or default_win_name

    now_str = time.strftime('%H:%M:%S')

    if target == "BAR":
        # Posiflex on USB Type-B -> BAR BOT (USB002)
        print(f"[{now_str}] [BAR] Received: '{job_title}' -> Routing to Posiflex USB '{target_win_name}'...")
        ok, msg = deliver_to_windows_printer(target_win_name, raw_bytes, job_title)
        if ok:
            print(f"[{now_str}] [BAR SUCCESS] Printed on Posiflex ('{target_win_name}')!\n")
            return True
        print(f"[{now_str}] [BAR WARNING] Windows spooler failed: {msg}")
        if ip:
            print(f"[{now_str}] Trying fallback socket {ip}:{port}...")
            sock_ok, sock_msg = deliver_to_socket(ip, port, raw_bytes)
            if sock_ok:
                print(f"[{now_str}] [BAR SUCCESS] Printed via fallback socket {ip}:{port}\n")
                return True
        print(f"[{now_str}] [BAR FAILED] Could not print '{job_title}'\n")
        return False

    elif target == "CASHIER":
        # Rugtek RP327 on USB Type-B -> RP327 Printer (USB001)
        print(f"[{now_str}] [CASHIER] Received: '{job_title}' -> Routing to Rugtek RP327 USB '{target_win_name}'...")
        ok, msg = deliver_to_windows_printer(target_win_name, raw_bytes, job_title)
        if ok:
            print(f"[{now_str}] [CASHIER SUCCESS] Printed on Rugtek RP327 ('{target_win_name}')!\n")
            return True
        print(f"[{now_str}] [CASHIER WARNING] Windows spooler failed: {msg}")
        if ip:
            print(f"[{now_str}] Trying fallback socket {ip}:{port}...")
            sock_ok, sock_msg = deliver_to_socket(ip, port, raw_bytes)
            if sock_ok:
                print(f"[{now_str}] [CASHIER SUCCESS] Printed via fallback socket {ip}:{port}\n")
                return True
        print(f"[{now_str}] [CASHIER FAILED] Could not print '{job_title}'\n")
        return False

    else:
        # Rugtek RP327 – Kitchen KOT on Ethernet -> 192.168.0.70:9100 (or Windows 'KITCHEN KOT')
        k_ip = ip or mapping.get("ip", "192.168.0.70")
        k_port = port or mapping.get("port", 9100)
        print(f"[{now_str}] [KITCHEN] Received: '{job_title}' -> Routing to Kitchen LAN {k_ip}:{k_port}...")
        ok, msg = deliver_to_socket(k_ip, k_port, raw_bytes)
        if ok:
            print(f"[{now_str}] [KITCHEN SUCCESS] Printed on Kitchen LAN {k_ip}:{k_port}!\n")
            return True
        
        # Fallback to Windows spooler if printer is installed as 'KITCHEN KOT'
        print(f"[{now_str}] [KITCHEN WARNING] LAN socket failed: {msg}. Trying Windows spooler '{target_win_name}'...")
        win_ok, win_msg = deliver_to_windows_printer(target_win_name, raw_bytes, job_title)
        if win_ok:
            print(f"[{now_str}] [KITCHEN SUCCESS] Printed via Windows spooler '{target_win_name}'!\n")
            return True
        print(f"[{now_str}] [KITCHEN FAILED] Could not reach Kitchen printer at {k_ip}:{k_port} or '{target_win_name}': {win_msg}\n")
        return False


async def listen_to_server(server_url: str, client_name: str):
    full_url = f"{server_url}?client_id={client_name}"
    tag = "LOCAL" if ("localhost" in server_url or "127.0.0.1" in server_url) else "CLOUD"
    is_first_attempt = True
    while True:
        try:
            if is_first_attempt:
                print(f"[{time.strftime('%H:%M:%S')}] [{tag}] Connecting to {server_url}...")
            async with websockets.connect(full_url, ping_interval=20, ping_timeout=20) as ws:
                print(f"[{time.strftime('%H:%M:%S')}] [{tag} ONLINE] >>> BRIDGE CONNECTED TO {server_url} <<<\n")
                is_first_attempt = False
                
                await ws.send(json.dumps({
                    "status": "READY",
                    "hostname": client_name,
                    "time": time.time(),
                    "printers": {
                        "bar": "Posiflex USB (BAR BOT -> USB002)",
                        "cashier": "Rugtek RP327 USB (RP327 Printer -> USB001)",
                        "kitchen": "Rugtek RP327 Ethernet (192.168.0.70:9100 / KITCHEN KOT)"
                    }
                }))

                async for message in ws:
                    try:
                        job = json.loads(message)
                        action = job.get("action")
                        if action == "PRINT":
                            dispatch_local_print(job)
                    except Exception as err:
                        print(f" [!] Error processing job from {tag}: {err}")

        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError):
            is_first_attempt = False
            await asyncio.sleep(5)
        except Exception as ex:
            is_first_attempt = False
            await asyncio.sleep(5)


async def run_bridge():
    client_name = socket.gethostname()
    urls = []
    if len(sys.argv) > 1:
        urls.append(sys.argv[1])
    else:
        urls = [DEFAULT_CLOUD_WS_URL, LOCAL_FALLBACK_WS_URL]
        custom = os.environ.get("BERMUDA_BACKEND_WS_URL")
        if custom and custom not in urls:
            urls.insert(0, custom)

    print_banner(urls)
    tasks = [listen_to_server(url, client_name) for url in urls]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    try:
        asyncio.run(run_bridge())
    except KeyboardInterrupt:
        print("\n[*] Print Bridge terminated by user.")
