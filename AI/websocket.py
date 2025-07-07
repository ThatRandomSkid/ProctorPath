import os
import io
import json
import asyncio
import base64
import websockets
import soundfile as sf
from dotenv import load_dotenv

load_dotenv()

async def connect_to_openai_websocket(audio_event):
    url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01"
    headers = {
        "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
        "OpenAI-Beta": "realtime=v1",
    }

    async with websockets.connect(url, extra_headers=headers) as ws:
        print("Connected to OpenAI WebSocket.")

        # Send audio event to the server
        await ws.send(audio_event)
        print("Audio event sent.")

        async for message in ws:
            event = json.loads(message)

            # Handle message and create response
            if event.get('type') == 'conversation.item.created':
                # Send command to generate a response
                response_message = {"type": "response.create"}
                await ws.send(json.dumps(response_message))
                print("Response create command sent.")

                audio_data_list = []

                # Listen for messages from OpenAI
                async for message in ws:
                    event = json.loads(message)
                    if event.get('type') == 'response.audio.delta':
                        audio_data_list.append(event['delta'])

                    if event.get('type') == 'response.audio.done':
                        # Combine all the audio chunks
                        full_audio_base64 = ''.join(audio_data_list)
                        audio_data = base64.b64decode(full_audio_base64)
                        return audio_data

def numpy_to_audio_bytes(audio_np, sample_rate):
    with io.BytesIO() as buffer:
        # Convert numpy array to WAV bytes
        sf.write(buffer, audio_np, samplerate=sample_rate, format='WAV')
        buffer.seek(0)
        wav_bytes = buffer.read()
    return wav_bytes

def audio_to_item_create_event(audio_data: tuple) -> str:
    sample_rate, audio_np = audio_data
    audio_bytes = numpy_to_audio_bytes(audio_np, sample_rate)
    
    # Base64 encode the audio data
    pcm_base64 = base64.b64encode(audio_bytes).decode('utf-8')
    
    event = {
        "type": "conversation.item.create",
        "item": {
            "type": "message",
            "role": "user",
            "content": [{
                "type": "input_audio",
                "audio": pcm_base64
            }]
        }
    }
    return json.dumps(event)

async def handle_audio(websocket, path):
    print("Client connected.")
    try:
        while True:
            # Receive audio data from Unity client
            audio_data = await websocket.recv()

            # Convert audio to event format
            audio_event = audio_to_item_create_event(audio_data)
            
            # Process the audio event with OpenAI
            audio_response = await connect_to_openai_websocket(audio_event)

            if isinstance(audio_response, bytes):
                await websocket.send(audio_response)  # Send audio response back to Unity
            else:
                print("Failed to receive audio response.")
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Client disconnected: {e}")

# Start WebSocket server
start_server = websockets.serve(handle_audio, "0.0.0.0", 8080)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
