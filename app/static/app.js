
// DOM elements
const logOutput = document.getElementById('log-output');
const clearLogBtn = document.getElementById('clear-log');

// WebRTC elements
const webrtcModel = document.getElementById('webrtc-model');
const webrtcVoice = document.getElementById('webrtc-voice');
const webrtcSystemPrompt = document.getElementById('webrtc-system-prompt');
const webrtcStartBtn = document.getElementById('webrtc-start');
const webrtcStopBtn = document.getElementById('webrtc-stop');
const webrtcMuteBtn = document.getElementById('webrtc-mute');
const webrtcUnmuteBtn = document.getElementById('webrtc-unmute');
const webrtcMessageInput = document.getElementById('webrtc-message');
const webrtcSendBtn = document.getElementById('webrtc-send');

// WebSocket elements
const wsModel = document.getElementById('ws-model');
const wsSystemPrompt = document.getElementById('ws-system-prompt');
const wsConnectBtn = document.getElementById('ws-connect');
const wsDisconnectBtn = document.getElementById('ws-disconnect');
const wsMessageInput = document.getElementById('ws-message');
const wsSendBtn = document.getElementById('ws-send');

// Global variables
let peerConnection = null;
let dataChannel = null;
let mediaStream = null;
let audioElement = null;
let ws = null;
let isMuted = false;

// Utility functions
function log(message, isError = false) {
    const entry = document.createElement('div');
    entry.textContent = `${new Date().toISOString().substring(11, 19)} - ${message}`;
    
    if (isError) {
        entry.style.color = 'red';
    }
    
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function openTab(tabName) {
    // Hide all tab contents
    const tabContents = document.getElementsByClassName('tab-content');
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove('active');
    }
    
    // Deactivate all tab buttons
    const tabButtons = document.getElementsByClassName('tab-btn');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    // Show the selected tab content and activate the button
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.tab-btn[onclick="openTab('${tabName}')"]`).classList.add('active');
}

// WebRTC functionality
async function startWebRTCConnection() {
    try {
        log('Starting WebRTC connection...');
        
        // Get ephemeral token from server
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: webrtcModel.value,
                voice: webrtcVoice.value,
                system_prompt: webrtcSystemPrompt.value
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to get ephemeral token');
        }
        
        const data = await response.json();
        const ephemeralKey = data.client_secret.value;
        
        log('Ephemeral token received');
        
        // Create peer connection
        peerConnection = new RTCPeerConnection();
        
        // Set up audio element
        audioElement = new Audio();
        audioElement.autoplay = true;
        
        // Handle remote track
        peerConnection.ontrack = (e) => {
            log('Received remote audio track');
            audioElement.srcObject = e.streams[0];
        };
        
        // Get local media stream
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        log('Local microphone access granted');
        
        // Add local audio track
        peerConnection.addTrack(mediaStream.getTracks()[0], mediaStream);
        
        // Create data channel
        dataChannel = peerConnection.createDataChannel('oai-events');
        dataChannel.onopen = () => {
            log('Data channel opened');
            webrtcSendBtn.disabled = false;
        };
        dataChannel.onclose = () => {
            log('Data channel closed');
            webrtcSendBtn.disabled = true;
        };
        dataChannel.onmessage = (e) => {
            const data = JSON.parse(e.data);
            log(`Received event: ${JSON.stringify(data, null, 2)}`);
            
            // If we receive content, log it
            if (data.type === 'content_block_delta' && data.delta && data.delta.content_block && data.delta.content_block.type === 'text') {
                log(`Assistant said: ${data.delta.content_block.text}`);
            }
        };
        
        // Create and set local description
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        // Send offer to OpenAI
        const baseUrl = "https://api.openai.com/v1/realtime";
        const model = webrtcModel.value;
        const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
            method: "POST",
            body: offer.sdp,
            headers: {
                Authorization: `Bearer ${ephemeralKey}`,
                "Content-Type": "application/sdp"
            },
        });
        
        if (!sdpResponse.ok) {
            throw new Error('Failed to connect to OpenAI Realtime API');
        }
        
        // Set remote description
        const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
        };
        await peerConnection.setRemoteDescription(answer);
        
        log('WebRTC connection established');
        
        // Update UI
        webrtcStartBtn.disabled = true;
        webrtcStopBtn.disabled = false;
        webrtcMuteBtn.disabled = false;
        webrtcUnmuteBtn.disabled = true;
        
    } catch (error) {
        log(`Error: ${error.message}`, true);
        stopWebRTCConnection();
    }
}

function stopWebRTCConnection() {
    log('Stopping WebRTC connection...');
    
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    if (audioElement) {
        audioElement.pause();
        audioElement.srcObject = null;
        audioElement = null;
    }
    
    // Update UI
    webrtcStartBtn.disabled = false;
    webrtcStopBtn.disabled = true;
    webrtcMuteBtn.disabled = true;
    webrtcUnmuteBtn.disabled = true;
    webrtcSendBtn.disabled = true;
    
    log('WebRTC connection stopped');
}

function sendWebRTCMessage() {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        log('Data channel not open', true);
        return;
    }
    
    const messageText = webrtcMessageInput.value.trim();
    if (!messageText) return;
    
    // Create a conversation item event using the correct format
    const message = {
        "type": "conversation.item.create",
        "conversation_item": {
            "role": "user",
            "content": [{
                "type": "text",
                "text": messageText
            }]
        }
    };
    
    log(`Sending message: ${JSON.stringify(message)}`);
    dataChannel.send(JSON.stringify(message));
    
    // Create a response event
    setTimeout(() => {
        const responseEvent = {
            "type": "response.create"
        };
        log(`Sending response event: ${JSON.stringify(responseEvent)}`);
        dataChannel.send(JSON.stringify(responseEvent));
    }, 500);
    
    webrtcMessageInput.value = '';
}

function toggleMute(mute) {
    if (!mediaStream) return;
    
    mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !mute;
    });
    
    isMuted = mute;
    webrtcMuteBtn.disabled = mute;
    webrtcUnmuteBtn.disabled = !mute;
    
    log(mute ? 'Microphone muted' : 'Microphone unmuted');
}

// WebSocket functionality
function connectWebSocket() {
    log('Connecting to WebSocket proxy...');
    
    // Connect to our server's WebSocket proxy endpoint
    ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/proxy`);
    
    ws.onopen = () => {
        log('WebSocket connected to proxy');
        
        // Send model configuration and system prompt
        ws.send(JSON.stringify({
            model: wsModel.value,
            system_prompt: wsSystemPrompt.value
        }));
        
        // Update UI
        wsConnectBtn.disabled = true;
        wsDisconnectBtn.disabled = false;
        wsSendBtn.disabled = false;
    };
    
    ws.onclose = (e) => {
        log(`WebSocket disconnected: ${e.reason || 'No reason provided'}`);
        
        // Update UI
        wsConnectBtn.disabled = false;
        wsDisconnectBtn.disabled = true;
        wsSendBtn.disabled = true;
        ws = null;
    };
    
    ws.onerror = (e) => {
        log('WebSocket error', true);
    };
    
    ws.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            log(`Received: ${JSON.stringify(data, null, 2)}`);
        } catch (error) {
            log(`Received non-JSON message: ${e.data}`);
        }
    };
}

function disconnectWebSocket() {
    if (ws) {
        ws.close();
        ws = null;
    }
}

function sendWebSocketMessage() {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        log('WebSocket not connected', true);
        return;
    }
    
    const messageText = wsMessageInput.value.trim();
    if (!messageText) return;
    
    try {
        // Create a conversation item event using the correct format
        const message = {
            "type": "conversation.item.create",
            "conversation_item": {
                "role": "user",
                "content": [{
                    "type": "text",
                    "text": messageText
                }]
            }
        };
        
        log(`Sending: ${JSON.stringify(message)}`);
        ws.send(JSON.stringify(message));
        
        // Create a response event
        setTimeout(() => {
            const responseEvent = {
                "type": "response.create"
            };
            log(`Sending response event: ${JSON.stringify(responseEvent)}`);
            ws.send(JSON.stringify(responseEvent));
        }, 500);
        
        wsMessageInput.value = '';
        
    } catch (error) {
        log(`Error sending message: ${error.message}`, true);
    }
}

// Event listeners
webrtcStartBtn.addEventListener('click', startWebRTCConnection);
webrtcStopBtn.addEventListener('click', stopWebRTCConnection);
webrtcMuteBtn.addEventListener('click', () => toggleMute(true));
webrtcUnmuteBtn.addEventListener('click', () => toggleMute(false));
webrtcSendBtn.addEventListener('click', sendWebRTCMessage);
webrtcMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendWebRTCMessage();
    }
});

wsConnectBtn.addEventListener('click', connectWebSocket);
wsDisconnectBtn.addEventListener('click', disconnectWebSocket);
wsSendBtn.addEventListener('click', sendWebSocketMessage);
wsMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendWebSocketMessage();
    }
});

clearLogBtn.addEventListener('click', () => {
    logOutput.innerHTML = '';
});

// Initialize
window.addEventListener('load', () => {
    log('Application loaded');
});

// Cleanup when the page closes
window.addEventListener('beforeunload', () => {
    stopWebRTCConnection();
    disconnectWebSocket();
});
