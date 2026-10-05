import socket
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple

CONFIG_FILE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "printer_config.json"))

DEFAULT_PRINTER_CONFIG = {
    "kitchen_printer_name": "KITCHEN KOT",
    "kitchen_printer_model": "Rugtek RP327 (Kitchen KOT)",
    "kitchen_printer_connection": "Ethernet",
    "kitchen_printer_ip": "192.168.0.70",
    "kitchen_printer_port": 9100,
    "kitchen_printer_windows_name": "KITCHEN KOT",
    "kitchen_printer_enabled": True,
    "auto_print_kot": True,
    "cashier_printer_name": "RP327 Printer",
    "cashier_printer_model": "Rugtek RP327 (Cashier / Billing)",
    "cashier_printer_connection": "USB",
    "cashier_printer_windows_name": "RP327 Printer",
    "cashier_printer_port_name": "USB001",
    "cashier_printer_ip": "",
    "cashier_printer_port": 9100,
    "cashier_printer_enabled": True,
    "auto_print_bill": True,
    "bar_printer_name": "BAR BOT",
    "bar_printer_model": "Posiflex (Bar BOT)",
    "bar_printer_connection": "USB",
    "bar_printer_windows_name": "BAR BOT",
    "bar_printer_port_name": "USB002",
    "bar_printer_ip": "",
    "bar_printer_port": 9100,
    "bar_printer_enabled": True,
    "auto_print_bar_kot": True,
    "bill_header_title": "THE BERMUDA COCKTAIL",
    "bill_header_subtitle": "Craft Cocktails & Gourmet Pub",
    "bill_address": "Main Boulevard, Pub Row",
    "bill_phone": "+91 98765 43210",
    "bill_gstin": "33ABCDE1234F1Z5",
    "bill_fssai": "12423002000123",
    "bill_footer_msg": "Thank You For Visiting! Drink Responsibly."
}

# --- ESC/POS Command Constants ---
ESC = b'\x1b'
GS = b'\x1d'

CMD_INIT = ESC + b'@'                      # Initialize printer
CMD_ALIGN_LEFT = ESC + b'a\x00'           # Left justify
CMD_ALIGN_CENTER = ESC + b'a\x01'         # Center justify
CMD_ALIGN_RIGHT = ESC + b'a\x02'          # Right justify
CMD_BOLD_ON = ESC + b'E\x01'              # Bold font on
CMD_BOLD_OFF = ESC + b'E\x00'             # Bold font off
CMD_TEXT_NORMAL = GS + b'!\x00'           # Standard character size
CMD_TEXT_DOUBLE_HEIGHT = GS + b'!\x01'    # Double height
CMD_TEXT_DOUBLE_WIDTH = GS + b'!\x10'     # Double width
CMD_TEXT_DOUBLE_SIZE = GS + b'!\x11'      # Double height & double width
CMD_UNDERLINE_ON = ESC + b'-\x01'         # Underline
CMD_UNDERLINE_OFF = ESC + b'-\x00'        # Underline off
CMD_FEED_AND_CUT = b'\n\n\n' + GS + b'V\x41\x03' # Feed 3 lines & cut paper
CMD_DRAWER_KICK = ESC + b'p\x00\x19\xfa'  # Kick cash drawer open


def load_printer_config() -> Dict[str, Any]:
    try:
        if os.path.exists(CONFIG_FILE_PATH):
            with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                merged = {**DEFAULT_PRINTER_CONFIG, **data}
                return merged
    except Exception as e:
        print(f"[PrinterService] Error reading config: {e}")
    return DEFAULT_PRINTER_CONFIG.copy()


def save_printer_config(config: Dict[str, Any]) -> Dict[str, Any]:
    try:
        os.makedirs(os.path.dirname(CONFIG_FILE_PATH), exist_ok=True)
        current = load_printer_config()
        current.update(config)
        with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
        return current
    except Exception as e:
        print(f"[PrinterService] Error saving config: {e}")
        return config


def send_to_windows_printer(printer_name: str, data: bytes, job_title: str = "Bermuda Print Job") -> Tuple[bool, str]:
    """
    Sends raw ESC/POS bytes directly to a Windows local USB or networked printer via win32print spooler.
    Works for USB Type-B printers like Posiflex (BAR BOT USB002) and Rugtek RP327 (RP327 Printer USB001).
    """
    if not printer_name or not printer_name.strip():
        return False, "Windows printer name is not specified"

    try:
        import win32print
    except ImportError:
        return False, "win32print module not installed (run: pip install pywin32)"

    try:
        installed = [p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
        target_clean = printer_name.strip()
        matched_printer = None
        for p in installed:
            if p.lower() == target_clean.lower():
                matched_printer = p
                break
        if not matched_printer:
            for p in installed:
                if target_clean.lower() in p.lower():
                    matched_printer = p
                    break
        actual_name = matched_printer or target_clean

        hPrinter = win32print.OpenPrinter(actual_name)
        try:
            hJob = win32print.StartDocPrinter(hPrinter, 1, (job_title, None, "RAW"))
            try:
                win32print.StartPagePrinter(hPrinter)
                win32print.WritePrinter(hPrinter, data)
                win32print.EndPagePrinter(hPrinter)
            finally:
                win32print.EndDocPrinter(hPrinter)
        finally:
            win32print.ClosePrinter(hPrinter)
        return True, f"Printed successfully to Windows printer '{actual_name}'"
    except Exception as e:
        return False, f"Windows printer '{printer_name}' error: {str(e)}"


def send_raw_esc_pos(ip: str, port: int, data: bytes, timeout: float = 3.0) -> Tuple[bool, str]:
    """
    Sends raw ESC/POS command bytes to a network thermal printer over TCP socket.
    Works for Rugtek RP327 Kitchen KOT (192.168.0.70:9100) and any standard ESC/POS Ethernet printer.
    """
    if not ip or not ip.strip():
        return False, "Printer IP address is not specified"

    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        sock.connect((ip.strip(), int(port)))
        sock.sendall(data)
        sock.close()
        return True, f"Successfully sent print job to {ip}:{port}"
    except socket.timeout:
        return False, f"Connection timed out connecting to printer at {ip}:{port}. Check if printer is ON and IP is correct."
    except ConnectionRefusedError:
        return False, f"Connection refused by printer at {ip}:{port}. Verify port (default 9100)."
    except Exception as e:
        return False, f"Printer network error on {ip}:{port}: {str(e)}"


class PrintBridgeManager:
    """
    Manages WebSocket connections to local POS counter machines inside the pub.
    Allows the cloud backend (elitedominators.com) to print over:
    - USB Type-B via Windows Spooler (Posiflex -> BAR BOT USB002, Rugtek RP327 -> RP327 Printer USB001)
    - LAN socket (Rugtek RP327 -> 192.168.0.70:9100 / KITCHEN KOT)
    """
    def __init__(self):
        self.active_bridges: Dict[str, Any] = {}

    async def register(self, bridge_id: str, websocket: Any):
        await websocket.accept()
        self.active_bridges[bridge_id] = websocket
        print(f"[PrintBridge] Local POS print bridge connected: {bridge_id}")

    def unregister(self, bridge_id: str):
        if bridge_id in self.active_bridges:
            del self.active_bridges[bridge_id]
            print(f"[PrintBridge] Local POS print bridge disconnected: {bridge_id}")

    def is_connected(self) -> bool:
        return len(self.active_bridges) > 0

    def get_connected_bridges(self) -> List[str]:
        return list(self.active_bridges.keys())

    async def dispatch_print(
        self,
        target: str,
        ip: str = "",
        port: int = 9100,
        windows_printer: str = "",
        data: bytes = b"",
        job_title: str = "Bermuda Job"
    ) -> Tuple[bool, str]:
        """
        Dispatches print jobs:
        1. If local print bridge is connected (POS machine in pub), forwards job via WebSocket.
        2. Otherwise, if on Windows and windows_printer specified, prints via Windows Spooler.
        3. If IP is specified, attempts direct TCP socket connection (e.g. Kitchen 192.168.0.70).
        """
        import base64

        if self.active_bridges:
            b64_data = base64.b64encode(data).decode('ascii')
            payload = {
                "action": "PRINT",
                "target": target,
                "ip": ip,
                "port": port,
                "windows_printer": windows_printer,
                "job_title": job_title,
                "data_b64": b64_data
            }
            dead = []
            sent = False
            for b_id, ws in list(self.active_bridges.items()):
                try:
                    await ws.send_json(payload)
                    sent = True
                except Exception:
                    dead.append(b_id)
            for d in dead:
                self.unregister(d)
            if sent:
                dest = f"Windows '{windows_printer}'" if windows_printer else f"{ip}:{port}"
                return True, f"Print job '{job_title}' relayed to local POS bridge ({', '.join(self.active_bridges.keys())}) -> {dest}"

        # If backend is running directly on Windows PC, try Windows Spooler first for USB printers
        if windows_printer and os.name == 'nt':
            win_ok, win_msg = send_to_windows_printer(windows_printer, data, job_title)
            if win_ok:
                return True, win_msg

        # Direct LAN socket attempt for network printer (e.g. Kitchen 192.168.0.70)
        if ip and ip.strip():
            return send_raw_esc_pos(ip=ip, port=port, data=data)

        # Fallback error
        if windows_printer:
            return False, f"Print bridge offline and cannot reach Windows printer '{windows_printer}'. Start Start_Print_Bridge.bat on counter PC."
        return False, "No valid printer destination or bridge available."


print_bridge = PrintBridgeManager()


def build_test_slip(printer_name: str, ip: str = "", port: int = 9100, connection_type: str = "Thermal 80mm") -> bytes:
    """
    Constructs a test page to verify printer functionality.
    """
    now = datetime.now().strftime("%d-%b-%Y %I:%M %p")
    cfg = load_printer_config()

    b = bytearray()
    b.extend(CMD_INIT)
    b.extend(CMD_ALIGN_CENTER)
    b.extend(CMD_BOLD_ON)
    b.extend(CMD_TEXT_DOUBLE_SIZE)
    b.extend(b"THE BERMUDA PUB\n")
    b.extend(CMD_TEXT_NORMAL)
    b.extend(CMD_BOLD_OFF)
    b.extend(b"*** PRINTER HARDWARE TEST ***\n")
    b.extend(f"{cfg.get('bill_header_subtitle', 'Craft Cocktails & Gourmet Kitchen')}\n".encode('latin-1', 'replace'))
    b.extend(b"------------------------------------------\n")
    b.extend(CMD_ALIGN_LEFT)
    b.extend(f"Printer:  {printer_name}\n".encode('latin-1', 'replace'))
    b.extend(f"Type:     {connection_type}\n".encode('latin-1', 'replace'))
    if ip:
        b.extend(f"Network:  {ip}:{port}\n".encode('latin-1', 'replace'))
    b.extend(f"Time:     {now}\n".encode('latin-1', 'replace'))
    b.extend(f"Status:   ONLINE & TEST VERIFIED\n".encode('latin-1', 'replace'))
    b.extend(b"------------------------------------------\n")
    b.extend(CMD_ALIGN_CENTER)
    b.extend(CMD_BOLD_ON)
    b.extend(b"HARDWARE INTEGRATION ACTIVE\n")
    b.extend(CMD_BOLD_OFF)
    b.extend(b"- Posiflex (Bar BOT): USB002\n")
    b.extend(b"- Rugtek RP327 (Cashier): USB001\n")
    b.extend(b"- Rugtek RP327 (Kitchen): 192.168.0.70\n")
    b.extend(b"==========================================\n")
    b.extend(b"Print Test Passed Successfully!\n")
    b.extend(CMD_FEED_AND_CUT)
    return bytes(b)


def build_kot_esc_pos(
    order_number: str,
    table_label: str,
    waiter_name: str,
    items: List[Dict[str, Any]],
    notes: Optional[str] = None,
    dept: str = "KITCHEN",
    created_at_str: Optional[str] = None
) -> bytes:
    """
    Builds a high-visibility, extra-dark Order Ticket (KOT / BOT) in ESC/POS format.
    Works for Rugtek RP327 Kitchen KOT (Ethernet) and Posiflex (BAR BOT USB002).
    """
    now = created_at_str or datetime.now().strftime("%d-%b-%Y %I:%M %p")
    ticket_type = "KOT (FOOD)" if dept.upper() == "KITCHEN" else "BOT (DRINKS)"
    title = f"*** {ticket_type} ***"

    b = bytearray()
    b.extend(CMD_INIT)
    # Enable double-strike mode for extra deep black thermal printing
    b.extend(ESC + b'G\x01')
    b.extend(ESC + b't\x00')
    
    # Header
    b.extend(CMD_ALIGN_CENTER)
    b.extend(CMD_BOLD_ON)
    b.extend(f"{title}\n".encode('latin-1', 'replace'))
    b.extend(CMD_BOLD_OFF)
    b.extend(b"----------------------------------------\n")
    
    # Large Table Number
    b.extend(CMD_TEXT_DOUBLE_SIZE)
    b.extend(CMD_BOLD_ON)
    b.extend(f"TABLE: {table_label}\n".encode('latin-1', 'replace'))
    b.extend(CMD_TEXT_NORMAL)
    b.extend(CMD_BOLD_OFF)
    
    # Metadata
    b.extend(CMD_ALIGN_LEFT)
    b.extend(CMD_BOLD_ON)
    b.extend(f"Order #:  {order_number}\n".encode('latin-1', 'replace'))
    b.extend(f"Time:     {now}\n".encode('latin-1', 'replace'))
    b.extend(f"Server:   {waiter_name}\n".encode('latin-1', 'replace'))
    if notes:
        b.extend(f"Note:     {notes}\n".encode('latin-1', 'replace'))
    b.extend(b"========================================\n")
    
    # Items Column Header: QTY (5) | ITEM DESCRIPTION (35)
    b.extend(b"QTY   ITEM DESCRIPTION\n")
    b.extend(b"----------------------------------------\n")
    b.extend(CMD_BOLD_OFF)
    
    total_qty = 0
    for it in items:
        qty = it.get("quantity", 1)
        name = it.get("product_name") or it.get("name") or "Item"
        item_note = it.get("notes")
        total_qty += qty
        
        # Double height for item line for great visibility
        b.extend(CMD_TEXT_DOUBLE_HEIGHT)
        b.extend(CMD_BOLD_ON)
        qty_str = f"[{qty}]".ljust(6)
        b.extend(f"{qty_str}{name}\n".encode('latin-1', 'replace'))
        b.extend(CMD_TEXT_NORMAL)
        b.extend(CMD_BOLD_OFF)
        
        if item_note:
            b.extend(f"      >> Note: {item_note}\n".encode('latin-1', 'replace'))
    
    b.extend(b"========================================\n")
    b.extend(CMD_ALIGN_RIGHT)
    b.extend(CMD_BOLD_ON)
    b.extend(f"Total Items: {total_qty}\n".encode('latin-1', 'replace'))
    b.extend(CMD_BOLD_OFF)
    b.extend(CMD_ALIGN_CENTER)
    b.extend(b"--- END OF TICKET ---\n")
    b.extend(CMD_FEED_AND_CUT)
    return bytes(b)


def build_bill_esc_pos(order_dict: Dict[str, Any]) -> bytes:
    """
    Builds a complete, extra-dark 80mm Customer Tax Invoice / Final Bill in ESC/POS format.
    Includes BOTH Food AND Drinks together on the same bill with quantities, unit rates, and totals.
    Works for Rugtek RP327 (RP327 Printer USB001).
    """
    cfg = load_printer_config()
    now = datetime.now().strftime("%d-%b-%Y %I:%M %p")
    
    table_num = order_dict.get("table_number") or "T-01"
    order_num = order_dict.get("order_number") or "ORD-0000"
    waiter = order_dict.get("waiter_name") or order_dict.get("collected_by") or "Staff"
    customer = order_dict.get("customer_name") or "Guest"
    payment_mode = order_dict.get("payment_mode") or "CASH"
    platform = order_dict.get("booking_platform") or "Direct / Walk-in"
    
    subtotal = float(order_dict.get("total_amount") or 0.0)
    discount_pct = float(order_dict.get("discount_percentage") or 0.0)
    discount_amt = float(order_dict.get("discount_amount") or 0.0)
    final_amt = float(order_dict.get("final_amount") or (subtotal - discount_amt))
    
    b = bytearray()
    b.extend(CMD_INIT)
    # Enable double-strike mode for extra deep black thermal printing
    b.extend(ESC + b'G\x01')
    b.extend(ESC + b't\x00')
    
    # Store Header
    b.extend(CMD_ALIGN_CENTER)
    b.extend(CMD_BOLD_ON)
    b.extend(CMD_TEXT_DOUBLE_HEIGHT)
    b.extend(f"{cfg.get('bill_header_title', 'THE BERMUDA COCKTAIL')}\n".encode('latin-1', 'replace'))
    b.extend(CMD_TEXT_NORMAL)
    b.extend(CMD_BOLD_OFF)
    
    if cfg.get("bill_header_subtitle"):
        b.extend(f"{cfg['bill_header_subtitle']}\n".encode('latin-1', 'replace'))
    if cfg.get("bill_address"):
        b.extend(f"{cfg['bill_address']}\n".encode('latin-1', 'replace'))
    if cfg.get("bill_phone"):
        b.extend(f"Phone: {cfg['bill_phone']}\n".encode('latin-1', 'replace'))
    if cfg.get("bill_gstin"):
        b.extend(f"GSTIN: {cfg['bill_gstin']}\n".encode('latin-1', 'replace'))
    if cfg.get("bill_fssai"):
        b.extend(f"FSSAI: {cfg['bill_fssai']}\n".encode('latin-1', 'replace'))
        
    b.extend(b"----------------------------------------\n")
    b.extend(CMD_BOLD_ON)
    b.extend(b"TAX INVOICE / FINAL BILL\n")
    b.extend(CMD_BOLD_OFF)
    b.extend(b"----------------------------------------\n")
    
    # Bill details (compact 40 columns to prevent right-edge clipping)
    b.extend(CMD_ALIGN_LEFT)
    b.extend(CMD_BOLD_ON)
    b.extend(f"Bill No:   {order_num}\n".encode('latin-1', 'replace'))
    b.extend(f"Table:     {table_num}\n".encode('latin-1', 'replace'))
    b.extend(f"Date/Time: {now}\n".encode('latin-1', 'replace'))
    b.extend(f"Server:    {waiter}\n".encode('latin-1', 'replace'))
    b.extend(f"Guest:     {customer}\n".encode('latin-1', 'replace'))
    b.extend(f"Channel:   {platform}\n".encode('latin-1', 'replace'))
    booking_ref = order_dict.get("booking_reference_id")
    if booking_ref and booking_ref != "-":
        b.extend(f"Book ID:   {booking_ref}\n".encode('latin-1', 'replace'))
    b.extend(CMD_BOLD_OFF)
    b.extend(b"========================================\n")
    
    # Column Header: ITEM (20) | QTY (4) | RATE (7) | AMT (9) -> Exactly 40 columns!
    b.extend(CMD_BOLD_ON)
    b.extend(f"{'ITEM'.ljust(20)}{'QTY'.rjust(4)}{'RATE'.rjust(7)}{'AMT'.rjust(9)}\n".encode('latin-1', 'replace'))
    b.extend(b"----------------------------------------\n")
    b.extend(CMD_BOLD_OFF)
    
    # Print all items (both food and drinks)
    items = order_dict.get("items", [])
    for it in items:
        raw_name = (it.get("product_name") or it.get("name") or "Item")
        name = raw_name[:19]
        qty = it.get("quantity", 1)
        rate = float(it.get("unit_price") or 0.0)
        line_tot = rate * qty
        
        line = f"{name.ljust(20)}{str(qty).rjust(4)}{f'{rate:.1f}'.rjust(7)}{f'{line_tot:.2f}'.rjust(9)}\n"
        b.extend(line.encode('latin-1', 'replace'))
        
    b.extend(b"----------------------------------------\n")
    
    # Totals
    b.extend(f"{'Subtotal:'.ljust(26)}{f'Rs. {subtotal:.2f}'.rjust(14)}\n".encode('latin-1', 'replace'))
    if discount_amt > 0:
        disc_label = f"Discount ({discount_pct:.0f}%):" if discount_pct > 0 else "Discount:"
        b.extend(f"{disc_label.ljust(26)}{f'-Rs. {discount_amt:.2f}'.rjust(14)}\n".encode('latin-1', 'replace'))
        
    b.extend(b"========================================\n")
    b.extend(CMD_BOLD_ON)
    b.extend(CMD_TEXT_DOUBLE_HEIGHT)
    b.extend(f"{'NET PAYABLE:'.ljust(22)}{f'Rs. {final_amt:.2f}'.rjust(18)}\n".encode('latin-1', 'replace'))
    b.extend(CMD_TEXT_NORMAL)
    b.extend(CMD_BOLD_OFF)
    b.extend(b"========================================\n")
    
    b.extend(CMD_BOLD_ON)
    b.extend(f"Payment Mode: {payment_mode}\n".encode('latin-1', 'replace'))
    b.extend(CMD_BOLD_OFF)
    b.extend(b"Prices inclusive of all applicable taxes\n")
    b.extend(b"----------------------------------------\n")
    
    # Footer
    b.extend(CMD_ALIGN_CENTER)
    b.extend(CMD_BOLD_ON)
    b.extend(f"{cfg.get('bill_footer_msg', 'Thank you for visiting Bermuda Pub!')}\n".encode('latin-1', 'replace'))
    b.extend(CMD_BOLD_OFF)
    b.extend(b"Follow us on Instagram @bermudacocktail\n")
    b.extend(CMD_FEED_AND_CUT)
    return bytes(b)
