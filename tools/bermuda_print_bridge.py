"""
The Bermuda Cocktail - Local Cloud-to-LAN Thermal Print Bridge
Runs on the restaurant POS counter PC (DESKTOP-FP8RQTF).
Connects to the cloud server (elitedominators.com) and dispatches
print jobs directly to Kitchen (192.168.0.70:9100) and Cashier printers over LAN.
"""

import asyncio
import websockets
import json
import base64
import socket
import sys
import os
import time

DEFAULT_CLOUD_WS_URL = "wss://bermuda-cocktail-backend.onrender.com/api/printers/ws/bridge"
LOCAL_FALLBACK_WS_URL = "ws://localhost:8000/api/printers/ws/bridge"

def get_server_url():
    if len(sys.argv) > 1:
        return sys.argv[1]
    return os.environ.get("BERMUDA_BACKEND_WS_URL", DEFAULT_CLOUD_WS_URL)

def print_banner(server_url):
    print("\n" + "=" * 62)
    print("   THE BERMUDA COCKTAIL - CLOUD-TO-LAN THERMAL PRINT BRIDGE")
    print("=" * 62)
    print(f" [*] Cloud Server: {server_url}")
    print(" [*] Machine Name:  " + socket.gethostname())
    print(" [*] Kitchen LAN:   192.168.0.70:9100 (RUGTEK RP326/RP327)")
    print(" [*] Billing LAN:   192.168.1.87:9100 (POSIFLEX PP-8800)")
    print("=" * 62 + "\n")

def deliver_to_printer(ip: str, port: int, raw_bytes: bytes) -> bool:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(4.0)
        sock.connect((ip.strip(), int(port)))
        sock.sendall(raw_bytes)
        sock.close()
        return True
    except Exception as e:
        print(f" [!] Error sending to {ip}:{port} -> {e}")
        return False

async def run_bridge():
    server_url = get_server_url()
    client_name = socket.gethostname()
    full_url = f"{server_url}?client_id={client_name}"

    print_banner(server_url)

    while True:
        try:
            print(f"[{time.strftime('%H:%M:%S')}] Connecting to Bermuda Cloud Server...")
            async with websockets.connect(full_url, ping_interval=20, ping_timeout=20) as ws:
                print(f"[{time.strftime('%H:%M:%S')}] >>> BRIDGE ONLINE! Listening for print orders from elitedominators.com <<<\n")
                
                # Send registration greeting
                await ws.send(json.dumps({
                    "status": "READY",
                    "hostname": client_name,
                    "time": time.time()
                }))

                async for message in ws:
                    try:
                        job = json.loads(message)
                        action = job.get("action")
                        if action == "PRINT":
                            target = job.get("target", "KITCHEN")
                            ip = job.get("ip", "192.168.0.70")
                            port = int(job.get("port", 9100))
                            job_title = job.get("job_title", "Print Job")
                            b64_data = job.get("data_b64", "")
                            raw_bytes = base64.b64decode(b64_data)

                            print(f"[{time.strftime('%H:%M:%S')}] Received: '{job_title}' -> Routing to {target} ({ip}:{port})...")
                            success = deliver_to_printer(ip, port, raw_bytes)
                            if success:
                                print(f"[{time.strftime('%H:%M:%S')}] [SUCCESS] Printed '{job_title}' on {ip}:{port}\n")
                            else:
                                print(f"[{time.strftime('%H:%M:%S')}] [FAILED] Could not connect to {ip}:{port}\n")
                    except Exception as err:
                        print(f" [!] Error processing job: {err}")

        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError, OSError) as ex:
            print(f"[{time.strftime('%H:%M:%S')}] Connection dropped ({ex}). Reconnecting in 5 seconds...")
            await asyncio.sleep(5)
        except Exception as ex:
            print(f"[{time.strftime('%H:%M:%S')}] Unexpected error: {ex}. Retrying in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(run_bridge())
    except KeyboardInterrupt:
        print("\n[*] Print Bridge terminated by user.")
