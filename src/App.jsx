import React from 'react';
import { Routes, Route, Navigate} from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './main.css';
import { useAuth } from './context/AuthContext';

import MenuBar from './components/Menu';
import ChatPage from './pages/ChatPage';
import Homepage from './pages/Homepage';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';

function App() {
  const { user, loadingUser } = useAuth();

  if (loadingUser) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div className="loading-spinner">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-500">
      {user && <MenuBar />}

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={user ? <Homepage /> : <Landing />} />
          <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/login" />} /> 
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />
          <Route path="*" element={user ? <ChatPage/> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;