import React, { createContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      console.log('[Socket] User logged in, establishing connection...');
      
      if (socketRef.current) {
        console.log('[Socket] Closing existing connection...');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }

      const newSocket = io('http://localhost:3000', {
        auth: {
          userId: user.id
        },
        transports: ['websocket']
      });

      newSocket.on('connect', () => {
        console.log('[Socket] Connected successfully');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        setIsConnected(false);
      });

      socketRef.current = newSocket;
      setSocket(newSocket);

    } else {
      console.log('[Socket] No user, cleaning up socket connection...');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    }

    return () => {
      if (socketRef.current) {
        console.log('[Socket] Component unmounting, cleaning up socket...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.id]);

  useEffect(() => {
    const handleLogout = () => {
      console.log('[Socket] Logout event received, cleaning up socket...');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };

    window.addEventListener('user-logout', handleLogout);
    
    return () => {
      window.removeEventListener('user-logout', handleLogout);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};