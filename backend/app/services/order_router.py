import json
from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Channels: 'bar', 'kitchen', 'staff', 'admin'
        self.active_connections: Dict[str, List[WebSocket]] = {
            "bar": [],
            "kitchen": [],
            "staff": [],
            "admin": []
        }

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = []
        self.active_connections[channel].append(websocket)

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_connections and websocket in self.active_connections[channel]:
            self.active_connections[channel].remove(websocket)

    async def broadcast_to_channel(self, channel: str, message: dict):
        if channel in self.active_connections:
            disconnected = []
            for connection in self.active_connections[channel]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    disconnected.append(connection)
            for conn in disconnected:
                self.active_connections[channel].remove(conn)

    async def broadcast_all(self, message: dict):
        for channel in self.active_connections:
            await self.broadcast_to_channel(channel, message)

manager = ConnectionManager()
