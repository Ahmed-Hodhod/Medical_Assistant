# Speech-to-Speech RTC API

A FastAPI server for real-time speech-to-speech communication using OpenAI's API. This application enables real-time communication with speech-to-text and text-to-speech capabilities powered by OpenAI's models.

## Features

- Real-time speech-to-text conversion using OpenAI's Whisper model
- Text response generation using OpenAI's GPT-4 model
- Text-to-speech conversion using OpenAI's TTS model
- WebSocket support for real-time communication
- Simple web client for testing

## Prerequisites

- Python 3.8 or higher
- OpenAI API key
- PyAudio dependencies (for audio processing)

## Installation

1. Clone this repository or download the files

2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Create a `.env` file based on the provided `.env.example`:

```bash
cp .env.example .env
```

4. Edit the `.env` file and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage

1. Start the FastAPI server:

```bash
python main.py
```

Or using uvicorn directly:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. Open your browser and navigate to `http://localhost:8000` to access the web client

3. Click "Connect to Server" to establish a WebSocket connection

4. Click "Start Recording" to begin recording audio

5. Click "Stop Recording" when finished to send the audio to the server

6. The server will process your speech, generate a response, and send back audio

7. Click "Play Response" to hear the AI's response

## API Documentation

Once the server is running, you can access the API documentation at `http://localhost:8000/docs`

## WebSocket API

Connect to the WebSocket endpoint at `/ws` to establish a real-time communication channel.

### Protocol

1. Client sends audio data as binary WebSocket messages
2. Server responds with:
   - JSON message with transcript: `{"type": "transcript", "text": "..."}`
   - Binary audio data for the speech response

## Security

The application supports API key authentication for added security. Set the `SERVICE_API_KEY` in your `.env` file and include it in the `X-API-Key` header when making requests.

## License

MIT