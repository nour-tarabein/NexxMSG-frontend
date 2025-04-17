// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './main.css';

import MenuBar from './components/Menu';
import Chat from './pages/Chat';
import Login from './pages/Login';
import Register from './pages/Register';
import ThemeToggle from './components/ThemeToggle';
import Landing from './pages/Landing';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-500">
      <MenuBar />

      <div className="flex-grow">
        <Routes>
          <Route path="/" element={<Landing/>} />
          <Route path="/landing" element={<Login />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>

      <footer className="p-4 flex justify-center border-t border-border">
        <ThemeToggle />
      </footer>
    </div>
  );
}

export default App;
