import React, { createContext, useEffect, useState, useRef, useCallback } from 'react';
import io from 'socket.io-client';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);

    // Create socket connection only once
    useEffect(() => {
        console.log('[SocketContext] Creating new socket connection');
        
        const socketUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
        console.log('[SocketContext] Socket URL:', socketUrl);
        
        const newSocket = io(socketUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            autoConnect: true,
            transports: ['websocket', 'polling']
        });
        
        socketRef.current = newSocket;
        setSocket(newSocket);
        
        newSocket.on('connect', () => {
            console.log(`[SocketContext] Socket connected with ID: ${newSocket.id}`);
            setIsConnected(true);
        });
        
        newSocket.on('disconnect', (reason) => {
            console.log(`[SocketContext] Socket disconnected. Reason: ${reason}`);
            setIsConnected(false);
        });
        
        newSocket.on('connect_error', (error) => {
            console.error(`[SocketContext] Connection error:`, error);
        });
        
        // Debug all events
        const onevent = newSocket.onevent;
        newSocket.onevent = function(packet) {
            const args = packet.data || [];
            console.log(`[SocketContext] Received event '${args[0]}':`, args.slice(1));
            onevent.call(this, packet);
        };
        
        // Clean up on unmount
        return () => {
            console.log('[SocketContext] Cleaning up socket connection');
            newSocket.disconnect();
        };
    }, []);
    
    const value = {
        socket,
        isConnected
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
