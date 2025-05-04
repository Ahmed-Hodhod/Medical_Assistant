import { Link, useLocation } from 'react-router-dom';
import { FaMicrophone, FaComment, FaHeartbeat, FaCog } from 'react-icons/fa';
import { useState, useEffect } from 'react';

const Navbar = () => {
  const location = useLocation();
  const [time, setTime] = useState(new Date());
  
  // Update clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  return (
    <>
      {/* Top navbar - primary navigation */}
      <nav className="bg-teal-500 text-white w-full">
        <div className="flex items-center h-14 px-4 justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <FaHeartbeat className="text-white text-xl animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">Medical Assistant</span>
              <span className="text-xs text-teal-100 leading-tight">Powered by Advanced AI</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm px-3 py-1">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {time.toLocaleTimeString([], { hour12: true }).slice(-2)}
            </div>
            
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FaCog className="text-white" />
            </div>
            
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Secondary navigation */}
      <div className="w-full bg-white shadow-md">
        <div className="flex justify-end h-12 px-4">
          <div className="flex space-x-1">
            <Link 
              to="/" 
              className={`flex items-center px-4 h-full text-sm font-medium transition-all ${
                location.pathname === '/' 
                  ? 'text-teal-600 border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              <FaMicrophone className="mr-2" />
              <span>Voice</span>
            </Link>
            <Link 
              to="/websocket" 
              className={`flex items-center px-4 h-full text-sm font-medium transition-all ${
                location.pathname === '/websocket' 
                  ? 'text-teal-600 border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              <FaComment className="mr-2" />
              <span>Chat</span>
            </Link>
            <Link 
              to="/about" 
              className={`flex items-center px-4 h-full text-sm font-medium transition-all ${
                location.pathname === '/about' 
                  ? 'text-teal-600 border-b-2 border-teal-500' 
                  : 'text-gray-600 hover:text-teal-600'
              }`}
            >
              <span>About</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;