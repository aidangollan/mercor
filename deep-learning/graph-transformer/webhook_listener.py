import os
import threading
import subprocess
import shutil
import logging
import time
from flask import Flask, request, jsonify
import requests
from flask_socketio import SocketIO
import base64

app = Flask(__name__)
socketio = SocketIO(app)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global flag and lock to avoid overlapping training runs
training_lock = threading.Lock()
training_in_progress = False

def run_training_pipeline():
    """
    Runs the entire pipeline: delete old data, pull new data using convert_data.py,
    trigger distributed training, and then send the trained model to a server.
    """
    global training_in_progress
    with training_lock:
        if training_in_progress:
            logger.info("Training already in progress; skipping new trigger.")
            socketio.emit('training_status', {'status': 'skipped', 'message': 'Training already in progress'})
            return
        training_in_progress = True

    try:
        logger.info("Starting training pipeline...")
        socketio.emit('training_status', {'status': 'started', 'message': 'Training pipeline started'})

        # Step 1: Delete old data directory
        data_dir = os.path.join("graph-transformer", "data", "clout", "raw")
        if os.path.exists(data_dir):
            logger.info("Deleting old data directory: %s", data_dir)
            shutil.rmtree(data_dir)
        os.makedirs(data_dir, exist_ok=True)
        socketio.emit('training_status', {'status': 'progress', 'step': 'data_cleanup', 'message': 'Old data deleted'})

        # Step 2: Run convert_data.py to pull the latest data from Neo4j.
        logger.info("Running data conversion using convert_data.py ...")
        socketio.emit('training_status', {'status': 'progress', 'step': 'data_conversion', 'message': 'Starting data conversion'})
        result = subprocess.run(
            ["python", "convert_data.py"],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            logger.error("Data conversion failed: %s", result.stderr)
            socketio.emit('training_status', {'status': 'error', 'step': 'data_conversion', 'message': 'Data conversion failed'})
            return
        else:
            logger.info("Data conversion completed:\n%s", result.stdout)
            socketio.emit('training_status', {'status': 'progress', 'step': 'data_conversion', 'message': 'Data conversion completed'})

        # Step 3: Trigger training.
        # This assumes that you're on an Ubuntu node with 8 H100s and that your training
        # script (train_graph_transformer.py) is set up for DDP with torchrun.
        logger.info("Starting training with torchrun...")
        socketio.emit('training_status', {'status': 'progress', 'step': 'training', 'message': 'Starting distributed training'})
        train_command = [
            "torchrun",
            "--nproc_per_node=8",
            os.path.join("graph-transformer", "train-graph-transformer.py"),
            "--epochs", "200",
            "--lr", "0.01"
        ]
        result = subprocess.run(train_command, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error("Training failed: %s", result.stderr)
            socketio.emit('training_status', {'status': 'error', 'step': 'training', 'message': 'Training failed'})
            return
        else:
            logger.info("Training completed:\n%s", result.stdout)
            socketio.emit('training_status', {'status': 'progress', 'step': 'training', 'message': 'Training completed'})

        # Step 4: Expect that the training script saved the trained model.
        model_path = os.path.join("graph-transformer", "best_model.pt")
        if not os.path.exists(model_path):
            logger.error("Trained model file not found at %s", model_path)
            socketio.emit('training_status', {'status': 'error', 'step': 'model_verification', 'message': 'Trained model not found'})
            return

        # Step 5: Send the model file to a remote server.
        model_server_url = os.getenv("MODEL_SERVER_URL", "http://localhost:5000/upload")
        logger.info("Sending the trained model to server at %s", model_server_url)
        socketio.emit('training_status', {'status': 'progress', 'step': 'model_upload', 'message': 'Uploading model to server'})
        with open(model_path, "rb") as model_file:
            files = {'model': model_file}
            response = requests.post(model_server_url, files=files)
            if response.status_code == 200:
                logger.info("Model successfully sent to the server.")
                socketio.emit('training_status', {'status': 'progress', 'step': 'model_upload', 'message': 'Model successfully uploaded'})
            else:
                logger.error(
                    "Failed to send model. Status code: %s, Response: %s",
                    response.status_code, response.text
                )
                socketio.emit('training_status', {'status': 'error', 'step': 'model_upload', 'message': f'Failed to upload model: {response.status_code}'})

        # Step 6: Also send the model directly to WebSocket clients
        try:
            logger.info("Sending model to connected WebSocket clients")
            with open(model_path, "rb") as model_file:
                model_data = model_file.read()
                # Convert binary data to base64 for safe transmission
                model_base64 = base64.b64encode(model_data).decode('utf-8')
                socketio.emit('model_data', {
                    'model_base64': model_base64,
                    'filename': 'best_model.pt'
                })
                logger.info("Model sent to connected clients")
        except Exception as e:
            logger.error("Failed to send model to WebSocket clients: %s", str(e))
            socketio.emit('training_status', {'status': 'error', 'step': 'model_websocket_send', 'message': f'Failed to send model to clients: {str(e)}'})

        socketio.emit('training_status', {'status': 'completed', 'message': 'Training pipeline completed successfully'})

    except Exception as e:
        logger.exception("Exception in training pipeline: %s", e)
        socketio.emit('training_status', {'status': 'error', 'step': 'unknown', 'message': f'Exception: {str(e)}'})
    finally:
        with training_lock:
            training_in_progress = False
        logger.info("Training pipeline finished.")

@socketio.on('connect')
def handle_connect():
    logger.info("Client connected")
    return {'status': 'connected'}

@socketio.on('disconnect')
def handle_disconnect():
    logger.info("Client disconnected")

@socketio.on('data_update')
def handle_data_update(data):
    """
    Handles 'data_update' events from WebSocket clients.
    When received, triggers the training process in a background thread.
    """
    logger.info("Received data_update event: %s", data)
    
    # Run the training pipeline in a separate thread so the socket can return quickly
    threading.Thread(target=run_training_pipeline).start()
    
    return {'status': 'accepted', 'message': 'Training triggered'}

if __name__ == "__main__":
    # Listen on port 3000 on all network interfaces
    port = 3000
    logger.info("Starting WebSocket server on port %s", port)
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)