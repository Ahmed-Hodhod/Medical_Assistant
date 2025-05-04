import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import WebRTCPage from './pages/WebRTCPage';
import WebSocketPage from './pages/WebSocketPage';
import { FaSpinner } from 'react-icons/fa';
import React from 'react';
function App() {
  // Set page title and theme color on load
  useEffect(() => {
    document.title = "Medical Voice Assistant";
    
    // Set theme color for mobile browsers
    const metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", "#0891b2"); // cyan-600
    } else {
      const meta = document.createElement("meta");
      meta.name = "theme-color";
      meta.content = "#0891b2";
      document.head.appendChild(meta);
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans">
        <Navbar />
        <div className="mx-auto px-4 py-4 md:py-6 max-w-7xl">
          <React.Suspense fallback={
            <div className="flex justify-center items-center h-64">
              <div className="flex flex-col items-center">
                <FaSpinner className="animate-spin text-cyan-600 text-3xl mb-2" />
                <span className="text-gray-600">Loading interface...</span>
              </div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<WebRTCPage />} />
              <Route path="/websocket" element={<WebSocketPage />} />
              <Route path="*" element={
                <div className="text-center py-20">
                  <div className="bg-white p-8 rounded-lg shadow-md mx-auto max-w-md border border-gray-200">
                    <div className="text-red-500 text-5xl mb-4">404</div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Page Not Found</h2>
                    <p className="text-gray-600 mb-6">The page you are looking for doesn't exist or has been moved.</p>
                    <a 
                      href="/" 
                      className="inline-block bg-cyan-600 hover:bg-cyan-700 text-white font-medium py-2 px-6 rounded-md transition-colors"
                    >
                      Return to Home
                    </a>
                  </div>
                </div>
              } />
            </Routes>
          </React.Suspense>
        </div>
        
        <footer className="bg-white border-t border-gray-200 py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <span className="text-cyan-800 font-semibold">Medical Voice Assistant</span>
                <span className="text-gray-500 mx-2">•</span>
                <span className="text-gray-500 text-sm">© {new Date().getFullYear()} Healthcare Solutions</span>
              </div>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-500 hover:text-cyan-600 transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="text-gray-500 hover:text-cyan-600 transition-colors">
                  Terms of Service
                </a>
                <a href="#" className="text-gray-500 hover:text-cyan-600 transition-colors">
                  Support
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;