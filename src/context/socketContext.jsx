import React, { createContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext'; 

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const { user } = useAuth(); 
    
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);
    const connectionTimeoutRef = useRef(null);

    useEffect(() => {
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        if (user && !socketRef.current) {
            connectionTimeoutRef.current = setTimeout(() => {
                const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
                const token = localStorage.getItem('token');

                console.log(`[SocketContext] Creating new socket connection for user ${user.id}`);

                const newSocket = io(socketUrl, {
                    auth: {
                        token: token
                    },
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    transports: ['websocket'],
                    forceNew: false,
                    multiplex: false
                });

                socketRef.current = newSocket;
                setSocket(newSocket);

                newSocket.on('connect', () => {
                    console.log(`[SocketContext] Socket connected for user ${user.id} with socket ID: ${newSocket.id}`);
                    setIsConnected(true);
                    
                    newSocket.emit('registerUser', user.id);
                });

                newSocket.on('disconnect', (reason) => {
                    console.log('[SocketContext] Socket disconnected. Reason:', reason);
                    setIsConnected(false);
                });
                
                newSocket.on('connect_error', (error) => {
                    console.error('[SocketContext] Connection error:', error.message);
                });

                newSocket.onAny((eventName, ...args) => {
                    console.log(`[SocketContext] Event received: ${eventName}`, args);
                });
            }, 100); 
        } else if (!user && socketRef.current) {
            console.log('[SocketContext] User logged out, disconnecting socket');
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.removeAllListeners();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
        }

        return () => {
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
            }
        };
    }, [user?.id]); 

    const value = {
        socket,
        isConnected,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};