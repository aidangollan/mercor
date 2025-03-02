import asyncio
import json
import websockets
from queue import Queue
import threading

class TrainingDataStreamer:
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.data_queue = Queue()
        self.server = None
        
    async def register(self, websocket):
        """Register a new client websocket."""
        self.clients.add(websocket)
        try:
            await websocket.wait_closed()
        finally:
            self.clients.remove(websocket)
    
    async def broadcast_data(self):
        """Broadcast data from queue to all connected clients."""
        while True:
            if not self.data_queue.empty():
                data = self.data_queue.get()
                if self.clients:  # Only process if there are connected clients
                    message = json.dumps(data)
                    await asyncio.gather(
                        *[client.send(message) for client in self.clients]
                    )
            await asyncio.sleep(0.1)  # Small delay to prevent busy waiting
    
    async def start_server(self):
        """Start the WebSocket server."""
        async with websockets.serve(self.register, self.host, self.port):
            await self.broadcast_data()  # This runs forever
    
    def add_training_data(self, data):
        """Add training data to the queue."""
        self.data_queue.put(data)
    
    def run_server(self):
        """Run the server in a separate thread."""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(self.start_server())
        loop.run_forever()
    
    def start(self):
        """Start the WebSocket server in a background thread."""
        server_thread = threading.Thread(target=self.run_server)
        server_thread.daemon = True  # Thread will exit when main program exits
        server_thread.start() 