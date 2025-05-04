import { useState, useRef, useEffect } from 'react';
import { FaTrash } from 'react-icons/fa';

interface LogMessage {
  id: number;
  time: string;
  message: string;
  isError?: boolean;
}

interface LogPanelProps {
  logs: LogMessage[];
  onClear: () => void;
}

const LogPanel = ({ logs, onClear }: LogPanelProps) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Logs</h3>
        <button 
          onClick={onClear}
          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded flex items-center text-sm"
        >
          <FaTrash className="mr-1" /> Clear Logs
        </button>
      </div>
      
      <div className="bg-gray-900 text-gray-100 rounded-lg p-4 h-80 overflow-y-auto font-mono text-sm">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic">No logs yet</div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`mb-1 ${log.isError ? 'text-red-400' : 'text-green-300'}`}
            >
              <span className="text-gray-500">[{log.time}]</span> {log.message}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default LogPanel;