import { useState, useEffect, useRef } from 'react';
import LogPanel from '../components/LogPanel';
import { FaPlay, FaStop, FaPaperPlane } from 'react-icons/fa';

// Arabic system prompt for the medical assistant
const ARABIC_SYSTEM_PROMPT = `أنت مساعد طبي يتحدث باللهجة المصرية، متخصص في حجوزات العيادات والمستشفيات. مهمتك هي مساعدة المرضى في حجز مواعيد، الإجابة على استفساراتهم عن الأطباء المتاحين، ساعات العمل، وشرح الإجراءات الطبية البسيطة. يجب أن تكون ودودًا ومتعاطفًا ومطمئنًا. تحدث دائماً باللهجة المصرية العامية، واستخدم التعبيرات الشائعة مثل "إزيك"، "عامل إيه"، "إن شاء الله"، "الحمد لله". احرص على إظهار التعاطف عند التعامل مع المرضى المتوترين، وقدم معلومات دقيقة لكن بطريقة مبسطة. إذا لم تكن متأكدًا من معلومة طبية معينة، احرص على التوضيح أنك ستحتاج للتأكد من الطبيب المختص.`;

interface LogMessage {
  id: number;
  time: string;
  message: string;
  isError?: boolean;
}

const WebSocketPage = () => {
  const [model, setModel] = useState('gpt-4o-realtime-preview-2024-12-17');
  const [systemPrompt, setSystemPrompt] = useState(ARABIC_SYSTEM_PROMPT);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  
  // Log utility function
  const addLog = (message: string, isError = false) => {
    const now = new Date();
    const time = now.toTimeString().substring(0, 8);
    setLogs(prev => [...prev, { 
      id: prev.length + 1, 
      time, 
      message, 
      isError 
    }]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Connect WebSocket
  const connectWebSocket = () => {
    addLog('Connecting to WebSocket proxy...');
    
    try {
      // Connect to our server's WebSocket proxy endpoint
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8000/ws/proxy`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        addLog('WebSocket connected to proxy');
        setIsConnected(true);
        
        // Send model configuration and system prompt
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            model,
            system_prompt: systemPrompt
          }));
        }
      };
      
      wsRef.current.onclose = (e) => {
        addLog(`WebSocket disconnected: ${e.reason || 'No reason provided'}`);
        setIsConnected(false);
      };
      
      wsRef.current.onerror = () => {
        addLog('WebSocket error occurred', true);
      };
      
      wsRef.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          addLog(`Received: ${JSON.stringify(data)}`);
        } catch (error) {
          addLog(`Received non-JSON message: ${e.data}`);
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        addLog(`Connection error: ${error.message}`, true);
      } else {
        addLog('An unknown connection error occurred', true);
      }
    }
  };
  
  // Disconnect WebSocket
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      addLog('WebSocket disconnected');
      setIsConnected(false);
    }
  };
  
  // Send message
  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('WebSocket not connected', true);
      return;
    }
    
    if (!message.trim()) return;
    
    try {
      // Create a conversation item event using the correct format
      const messageObj = {
        "type": "conversation.item.create",
        "conversation_item": {
          "role": "user",
          "content": [{
            "type": "text",
            "text": message
          }]
        }
      };
      
      addLog(`Sending: ${message}`);
      wsRef.current.send(JSON.stringify(messageObj));
      
      // Create a response event
      setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const responseEvent = {
            "type": "response.create"
          };
          wsRef.current.send(JSON.stringify(responseEvent));
        }
      }, 500);
      
      setMessage('');
    } catch (error) {
      if (error instanceof Error) {
        addLog(`Error sending message: ${error.message}`, true);
      } else {
        addLog('An unknown error occurred while sending message', true);
      }
    }
  };
  
  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, []);
  
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">WebSocket Connection</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            disabled={isConnected}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={4}
            className="w-full p-2 border border-gray-300 rounded-md text-right"
            dir="rtl"
            disabled={isConnected}
          />
        </div>
        
        <div className="flex gap-2 mb-6">
          {!isConnected ? (
            <button
              onClick={connectWebSocket}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center"
            >
              <FaPlay className="mr-2" /> Connect
            </button>
          ) : (
            <button
              onClick={disconnectWebSocket}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center"
            >
              <FaStop className="mr-2" /> Disconnect
            </button>
          )}
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow p-2 border border-gray-300 rounded-md"
            disabled={!isConnected}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected}
            className={`px-4 py-2 rounded-md flex items-center ${
              isConnected 
                ? 'bg-blue-500 hover:bg-blue-600 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <FaPaperPlane className="mr-2" /> Send
          </button>
        </div>
      </div>
      
      <LogPanel logs={logs} onClear={clearLogs} />
    </div>
  );
};

export default WebSocketPage;