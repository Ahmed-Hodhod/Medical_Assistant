import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import LogPanel from '../components/LogPanel';
import { FaMicrophone, FaMicrophoneSlash, FaPlay, FaStop, FaPaperPlane, FaCalendarAlt, FaHeartbeat, FaUser, FaMapMarkerAlt, FaPhone, FaClock, FaHospital, FaComments, FaTrash } from 'react-icons/fa';

// Arabic system prompt for the medical assistant
const ARABIC_SYSTEM_PROMPT = `أنت مساعد طبي يتحدث باللهجة المصرية، متخصص في حجوزات العيادات والمستشفيات. مهمتك هي مساعدة المرضى في حجز مواعيد، الإجابة على استفساراتهم عن الأطباء المتاحين، ساعات العمل، وشرح الإجراءات الطبية البسيطة. يجب أن تكون ودودًا ومتعاطفًا ومطمئنًا. تحدث دائماً باللهجة المصرية العامية، واستخدم التعبيرات الشائعة مثل "إزيك"، "عامل إيه"، "إن شاء الله"، "الحمد لله". احرص على إظهار التعاطف عند التعامل مع المرضى المتوترين، وقدم معلومات دقيقة لكن بطريقة مبسطة. إذا لم تكن متأكدًا من معلومة طبية معينة، احرص على التوضيح أنك ستحتاج للتأكد من الطبيب المختص.`;

interface LogMessage {
  id: number;
  time: string;
  message: string;
  isError?: boolean;
}

interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  isPartial: boolean;
}

// Voice Transcript Component
const VoiceTranscript = ({ 
  entries, 
  onClear,
  partialText = '',
  isListening = false
}: { 
  entries: TranscriptEntry[]; 
  onClear: () => void;
  partialText?: string;
  isListening?: boolean;
}) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when transcript updates
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, partialText]);
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 py-2 px-4 flex justify-between items-center">
        <div className="font-medium text-gray-700 flex items-center">
          <FaComments className="mr-2 text-teal-600" /> 
          <span>نص المحادثة الصوتية</span>
        </div>
        <div className="flex items-center space-x-2">
          {isListening && (
            <div className="flex items-center text-xs text-teal-600">
              <span className="h-2 w-2 bg-teal-500 rounded-full mr-1 animate-pulse"></span>
              <span>جاري الاستماع</span>
            </div>
          )}
          <button 
            onClick={onClear}
            className="text-red-500 hover:bg-red-50 p-1 rounded text-xs flex items-center"
            title="مسح النص"
          >
            <FaTrash className="mr-1" /> مسح
          </button>
        </div>
      </div>
      
      <div className="h-64 overflow-y-auto p-4" dir="rtl">
        {entries.length === 0 && !partialText ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            <p>ستظهر هنا نص المحادثة الصوتية بينك وبين المساعد الطبي</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div 
                key={entry.id}
                className={`${
                  entry.role === 'user' ? 'text-right' : 
                  entry.role === 'system' ? 'text-center italic' : 'text-left'
                }`}
              >
                <div className={`
                  inline-block rounded-lg px-4 py-2 max-w-[85%]
                  ${entry.role === 'user' 
                    ? 'bg-teal-100 text-teal-800' 
                    : entry.role === 'system'
                    ? 'bg-gray-100 text-gray-600 text-xs' 
                    : 'bg-blue-100 text-blue-800'}
                `}>
                  {entry.role !== 'system' && (
                    <div className="text-xs mb-1 opacity-75">
                      {entry.role === 'user' ? 'أنت' : 'المساعد الطبي'} • {entry.timestamp}
                    </div>
                  )}
                  <div>{entry.text}</div>
                </div>
              </div>
            ))}
            
            {/* Show partial text with typing animation */}
            {partialText && (
              <div className="text-right">
                <div className="inline-block bg-teal-100 text-teal-800 rounded-lg px-4 py-2 max-w-[85%] opacity-75">
                  <div className="text-xs mb-1 opacity-75">
                    أنت • جاري التحدث...
                  </div>
                  <div>
                    {partialText}<span className="inline-block w-1.5 h-3 bg-teal-500 ml-1 animate-pulse"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

const WebRTCPage = () => {
  // Hidden technical states
  const [model, setModel] = useState('gpt-4o-realtime-preview-2024-12-17');
  const [voice, setVoice] = useState('verse');
  const [systemPrompt, setSystemPrompt] = useState(ARABIC_SYSTEM_PROMPT);
  
  // User visible states
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [activeDepartment, setActiveDepartment] = useState('all');
  const [showLogs, setShowLogs] = useState(false);
  const [conversation, setConversation] = useState<{role: string, content: string, time: string}[]>([]);
  
  // Transcript states
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  // Patient information
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    phone: '',
    symptoms: ''
  });
  
  // Refs for WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  
  // Clear transcript
  const clearTranscript = () => {
    setTranscriptEntries([]);
    setPartialTranscript('');
  };
  
  // Add entry to transcript
  const addTranscriptEntry = (role: 'user' | 'assistant' | 'system', text: string, isPartial = false) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // For partial user speech, just update the partial transcript state
    if (role === 'user' && isPartial) {
      setPartialTranscript(text);
      return;
    }
    
    // For complete utterances, add to transcript entries
    const newEntry: TranscriptEntry = {
      id: `${role}-${Date.now()}`,
      role,
      text,
      timestamp,
      isPartial: false
    };
    
    setTranscriptEntries(prev => [...prev, newEntry]);
    
    // Clear partial transcript if this is a final user utterance
    if (role === 'user') {
      setPartialTranscript('');
    }
  };
  
  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation]);
  
  // Log utility function (hidden from user)
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
  
  // Add message to conversation (visible to user)
  const addMessage = (role: string, content: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setConversation(prev => [...prev, { role, content, time }]);
  };
  
  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };
  
  // Start WebRTC connection
  const startConversation = async () => {
    try {
      addLog('Starting WebRTC connection...');
      
      // Get ephemeral token from server
      const response = await axios.post('http://localhost:8000/api/sessions', {
        model,
        voice,
        system_prompt: systemPrompt
      });
      
      const ephemeralKey = response.data.client_secret.value;
      addLog('Ephemeral token received');
      
      // Create peer connection
      peerConnectionRef.current = new RTCPeerConnection();
      
      // Set up audio element
      audioElementRef.current = new Audio();
      audioElementRef.current.autoplay = true;
      
      // Handle remote track
      peerConnectionRef.current.ontrack = (e) => {
        addLog('Received remote audio track');
        if (audioElementRef.current) {
          audioElementRef.current.srcObject = e.streams[0];
        }
      };
      
      // Get local media stream
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('Local microphone access granted');
      setIsListening(true);
      
      // Add local audio track
      peerConnectionRef.current.addTrack(
        mediaStreamRef.current.getTracks()[0], 
        mediaStreamRef.current
      );
      
      // Create data channel
      dataChannelRef.current = peerConnectionRef.current.createDataChannel('oai-events');
      
      dataChannelRef.current.onopen = () => {
        addLog('Data channel opened');
        setIsConnected(true);
        // Add initial greeting to the conversation
        addMessage('assistant', 'أهلا بيك في المساعد الطبي. كيف ممكن أساعدك النهاردة؟');
        // Add to transcript
        addTranscriptEntry('system', 'تم تشغيل المساعد الصوتي. يمكنك التحدث الآن.');
        setTimeout(() => {
          addTranscriptEntry('assistant', 'أهلا بيك في المساعد الطبي. كيف ممكن أساعدك النهاردة؟');
        }, 800);
      };
      
      dataChannelRef.current.onclose = () => {
        addLog('Data channel closed');
        setIsConnected(false);
        setIsListening(false);
      };
      
      dataChannelRef.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle different event types
          if (data.type === 'content_block_delta' && data.delta?.content_block?.type === 'text') {
            addLog(`Assistant said: ${data.delta.content_block.text}`);
            addMessage('assistant', data.delta.content_block.text);
            addTranscriptEntry('assistant', data.delta.content_block.text);
          } 
          // Handle speech events for the assistant
          else if (data.type === 'speech.started') {
            addLog('Assistant started speaking');
          }
          else if (data.type === 'speech.ended') {
            addLog('Assistant finished speaking');
          }
          // This is the important part - handle audio transcription events
          else if (data.type === 'audio.transcription') {
            const transcriptionText = data.transcription?.text || '';
            const isPartial = data.transcription?.is_final === false;
            
            addLog(`User transcription (${isPartial ? 'partial' : 'final'}): ${transcriptionText}`);
            
            if (isPartial) {
              // Update the partial transcript as the user speaks
              setPartialTranscript(transcriptionText);
            } else if (transcriptionText.trim()) {
              // This is a final transcription
              addMessage('user', transcriptionText);
              addTranscriptEntry('user', transcriptionText);
              setPartialTranscript(''); // Clear partial transcript
            }
          }
          else {
            addLog(`Received event: ${JSON.stringify(data)}`);
          }
        } catch (error) {
          addLog(`Received non-JSON message: ${e.data}`, true);
        }
      };
      
      // Create and set local description
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send offer to OpenAI
      const baseUrl = "https://api.openai.com/v1/realtime";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp"
        },
      });
      
      if (!sdpResponse.ok) {
        throw new Error('فشل الاتصال بالمساعد الطبي');
      }
      
      // Set remote description
      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer' as RTCSdpType, sdp: answer.sdp }));
      
      addLog('WebRTC connection established');
      setIsConnected(true);
      
    } catch (error) {
      if (error instanceof Error) {
        addLog(`Error: ${error.message}`, true);
        addMessage('system', 'عفواً، حدث خطأ في الاتصال بالمساعد الطبي. برجاء المحاولة مرة أخرى.');
        addTranscriptEntry('system', 'عفواً، حدث خطأ في الاتصال بالمساعد الطبي.');
      } else {
        addLog('An unknown error occurred', true);
        addMessage('system', 'عفواً، حدث خطأ غير معروف. برجاء المحاولة مرة أخرى.');
        addTranscriptEntry('system', 'عفواً، حدث خطأ غير معروف.');
      }
      stopConversation();
    }
  };
  
  // Stop WebRTC connection
  const stopConversation = () => {
    addLog('Stopping WebRTC connection...');
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
    
    setIsConnected(false);
    setIsMuted(false);
    setIsListening(false);
    setPartialTranscript('');
    
    addLog('WebRTC connection stopped');
    addMessage('system', 'انتهت المحادثة مع المساعد الطبي');
    addTranscriptEntry('system', 'انتهت المحادثة مع المساعد الطبي.');
  };
  
  // Toggle mute
  const toggleMute = (mute: boolean) => {
    if (!mediaStreamRef.current) return;
    
    mediaStreamRef.current.getAudioTracks().forEach(track => {
      track.enabled = !mute;
    });
    
    setIsMuted(mute);
    setIsListening(!mute);
    addLog(mute ? 'Microphone muted' : 'Microphone unmuted');
    addTranscriptEntry('system', mute ? 'تم كتم الميكروفون.' : 'تم تشغيل الميكروفون.');
  };
  
  // Send message
  const sendMessage = () => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      addLog('Data channel not open', true);
      addMessage('system', 'عفواً، حدث خطأ في الاتصال. برجاء إعادة المحاولة.');
      return;
    }
    
    if (!message.trim()) return;
    
    // Add user message to conversation
    addMessage('user', message);
    addTranscriptEntry('user', message);
    
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
    
    addLog(`Sending message: ${message}`);
    dataChannelRef.current.send(JSON.stringify(messageObj));
    
    // Create a response event
    setTimeout(() => {
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        const responseEvent = {
          "type": "response.create"
        };
        dataChannelRef.current.send(JSON.stringify(responseEvent));
      }
    }, 500);
    
    setMessage('');
  };
  
  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      stopConversation();
    };
  }, []);

  // Departments data (for UI only)
  const departments = [
    { id: 'all', name: 'كل التخصصات', icon: <FaHospital /> },
    { id: 'cardiology', name: 'قلب', icon: <FaHeartbeat /> },
    { id: 'pediatrics', name: 'أطفال', icon: <FaUser /> },
    { id: 'orthopedics', name: 'عظام', icon: <FaUser /> },
    { id: 'dermatology', name: 'جلدية', icon: <FaUser /> },
    { id: 'neurology', name: 'مخ وأعصاب', icon: <FaUser /> }
  ];
  
  return (
    <div className="w-full mx-auto bg-gray-50 min-h-screen">
      {/* Main header with welcome message */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-600 py-6 px-6 shadow-md text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center mb-2">
            <FaHeartbeat className="text-white text-3xl mr-3" />
            <h1 className="text-2xl font-bold text-white">المساعد الطبي</h1>
          </div>
          <p className="text-white text-sm md:text-base opacity-90">
            تحدث مع مساعدنا الذكي لحجز موعد طبي أو الاستفسار عن خدماتنا
          </p>
          <div className="flex justify-center mt-4">
            <div className="bg-white/20 text-white text-sm py-1 px-3 rounded-full flex items-center">
              <FaPhone className="mr-1" /> خط المساعدة: 16676
            </div>
          </div>
        </div>
      </div>
      
      {/* Departments selector */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex overflow-x-auto py-3 gap-2 scrollbar-hide">
            {departments.map(dept => (
              <button
                key={dept.id}
                onClick={() => setActiveDepartment(dept.id)}
                className={`flex items-center px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                  activeDepartment === dept.id
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{dept.icon}</span>
                <span>{dept.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat interface */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
              {/* Chat header */}
              <div className="border-b border-gray-100 px-6 py-4 flex justify-between items-center bg-gray-50">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                    <FaHeartbeat />
                  </div>
                  <div className="mr-3">
                    <h3 className="font-medium">المساعد الطبي</h3>
                    <div className="text-xs text-gray-500 flex items-center">
                      {isConnected ? (
                        <>
                          <span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1.5"></span>
                          متصل الآن
                        </>
                      ) : (
                        <>
                          <span className="h-1.5 w-1.5 bg-gray-300 rounded-full mr-1.5"></span>
                          غير متصل
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Control buttons */}
                {isConnected ? (
                  <div className="flex gap-2">
                    {!isMuted ? (
                      <button
                        onClick={() => toggleMute(true)}
                        className="text-amber-500 hover:bg-amber-50 p-2 rounded-full"
                        title="كتم الميكروفون"
                      >
                        <FaMicrophoneSlash />
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleMute(false)}
                        className="text-teal-500 hover:bg-teal-50 p-2 rounded-full"
                        title="تشغيل الميكروفون"
                      >
                        <FaMicrophone />
                      </button>
                    )}
                    <button
                      onClick={stopConversation}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-full"
                      title="إنهاء المحادثة"
                    >
                      <FaStop />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startConversation}
                    className="text-teal-500 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-full text-sm flex items-center"
                  >
                    <FaPlay className="mr-1" /> بدء المحادثة
                  </button>
                )}
              </div>
              
              {/* Chat messages */}
              <div className="h-72 overflow-y-auto p-4" dir="rtl">
                {conversation.length === 0 && !isConnected ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <FaHeartbeat className="text-teal-500 text-2xl" />
                    </div>
                    <p className="mb-2">مرحباً بك في المساعد الطبي</p>
                    <p className="text-sm max-w-xs">اضغط على زر "بدء المحادثة" للتحدث مع المساعد الطبي وحجز موعدك</p>
                  </div>
                ) : (
                  <>
                    {conversation.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`mb-4 max-w-[80%] ${
                          msg.role === 'user' ? 'mr-auto text-left' : 
                          msg.role === 'system' ? 'mx-auto text-center' : 'ml-auto text-right'
                        }`}
                      >
                        {msg.role === 'system' ? (
                          <div className="bg-gray-100 rounded-lg px-4 py-2 inline-block text-gray-600 text-sm">
                            {msg.content}
                          </div>
                        ) : msg.role === 'user' ? (
                          <div className="flex flex-col">
                            <div className="bg-teal-500 text-white rounded-lg px-4 py-2">
                              {msg.content}
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{msg.time}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <div className="bg-gray-100 rounded-lg px-4 py-2">
                              {msg.content}
                            </div>
                            <span className="text-xs text-gray-500 mt-1">{msg.time}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={messageEndRef} />
                  </>
                )}
              </div>
              
              {/* Message input */}
              <div className="border-t border-gray-100 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isConnected ? "اكتب رسالتك هنا..." : "اضغط على بدء المحادثة أولاً..."}
                    className={`flex-grow p-3 border ${
                      isConnected ? 'border-teal-300' : 'border-gray-200 bg-gray-50'
                    } rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500`}
                    disabled={!isConnected}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    dir="rtl"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!isConnected}
                    className={`p-3 rounded-lg flex items-center justify-center ${
                      isConnected 
                        ? 'bg-teal-500 hover:bg-teal-600 text-white' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <FaPaperPlane />
                  </button>
                </div>
                
                {/* Microphone status indicator */}
                {isConnected && (
                  <div className="mt-2 text-xs text-center text-gray-500">
                    {isMuted ? (
                      <span className="flex items-center justify-center">
                        <FaMicrophoneSlash className="mr-1 text-amber-500" /> الميكروفون مغلق
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <FaMicrophone className="mr-1 text-teal-500 animate-pulse" /> المساعد يستمع إليك، يمكنك التحدث
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Voice Transcript Component */}
            <div className="mt-6">
              <VoiceTranscript 
                entries={transcriptEntries} 
                onClear={clearTranscript}
                partialText={partialTranscript}
                isListening={isListening && !isMuted}
              />
            </div>
            
            {/* Developer logs toggle (hidden by default) */}
            <div className="mt-4 text-center">
              <button 
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showLogs ? "إخفاء السجلات التقنية" : "عرض السجلات التقنية"}
              </button>
              
              {showLogs && (
                <div className="mt-2 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                  <div className="border-b border-gray-100 px-4 py-2 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-sm font-medium text-gray-700">سجلات النظام</h3>
                    <button 
                      onClick={clearLogs}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      مسح السجلات
                    </button>
                  </div>
                  <LogPanel logs={logs} onClear={clearLogs} />
                </div>
              )}
            </div>
          </div>
          
          {/* Appointment booking panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden sticky top-20">
              <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
                <h3 className="font-medium text-teal-800 flex items-center">
                  <FaCalendarAlt className="ml-2" /> حجز موعد سريع
                </h3>
              </div>
              
              <div className="p-4" dir="rtl">
                <form className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                    <input
                      type="text"
                      value={patientInfo.name}
                      onChange={(e) => setPatientInfo({...patientInfo, name: e.target.value})}
                      placeholder="الاسم بالكامل"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={patientInfo.phone}
                      onChange={(e) => setPatientInfo({...patientInfo, phone: e.target.value})}
                      placeholder="01xxxxxxxxx"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الأعراض أو سبب الزيارة</label>
                    <textarea
                      value={patientInfo.symptoms}
                      onChange={(e) => setPatientInfo({...patientInfo, symptoms: e.target.value})}
                      placeholder="اكتب وصفاً مختصراً للأعراض"
                      rows={3}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                  
                  <div className="bg-gray-50 -mx-4 p-4 mt-4">
                    <p className="text-sm text-gray-600 mb-3">اختر طريقة الحجز المناسبة لك:</p>
                    
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-md py-3 flex items-center justify-center"
                        onClick={() => {
                          if (isConnected && patientInfo.name && patientInfo.phone) {
                            const promptMessage = `اسمي ${patientInfo.name} ورقم هاتفي ${patientInfo.phone}، وأرغب في حجز موعد. أعاني من ${patientInfo.symptoms || 'بعض الأعراض'}.`;
                            setMessage(promptMessage);
                          } else if (!isConnected) {
                            startConversation();
                          }
                        }}
                      >
                        <FaMicrophone className="ml-2" /> حجز بمساعدة الذكاء الاصطناعي
                      </button>
                      
                      <button
                        type="button"
                        className="w-full bg-white border border-teal-500 text-teal-600 hover:bg-teal-50 rounded-md py-3 flex items-center justify-center"
                        onClick={() => window.open('tel:16676')}
                      >
                        <FaPhone className="ml-2" /> اتصل بنا مباشرة
                      </button>
                      
                      <div className="text-center text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                        <p>أو يمكنك زيارة أقرب فرع</p>
                        <div className="flex items-center justify-center mt-1">
                          <FaMapMarkerAlt className="text-red-500 ml-1" />
                          <span>فروعنا في جميع أنحاء القاهرة والجيزة</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
              
              <div className="bg-teal-50 p-3 text-xs text-teal-800 flex" dir="rtl">
                <FaClock className="text-teal-600 ml-2 mt-0.5" />
                <div>
                  <p className="font-semibold">ساعات العمل:</p>
                  <p>السبت - الخميس: 9 صباحاً - 10 مساءً</p>
                  <p>الجمعة: 1 ظهراً - 10 مساءً</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Advanced configuration panel - Only visible for devs when showLogs is true */}
      {showLogs && (
        <div className="max-w-5xl mx-auto mt-6 p-4 bg-white rounded-xl shadow-md border border-gray-100 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <FaCog className="mr-2" /> إعدادات متقدمة (للمطورين فقط)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نموذج الذكاء الاصطناعي</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
                disabled={isConnected}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الصوت</label>
              <select
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md bg-white"
                disabled={isConnected}
              >
                <option value="shimmer">Shimmer</option>
                <option value="verse">Verse</option>
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
              </select>
            </div>
          </div>
          
          <div>
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
        </div>
      )}
    </div>
  );
};

export default WebRTCPage;