// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './main.css';

import MenuBar from './components/Menu';
import ChatPage from './pages/ChatPage'; // Import the new ChatPage
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-500">
      <MenuBar />

      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/chat" element={<ChatPage />} /> 
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<ChatPage/>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;