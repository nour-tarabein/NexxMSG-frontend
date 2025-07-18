import React, { createContext, useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { getRequest, postRequest } from '../utils/services';
import { SocketContext } from './socketContext';
import * as keyManager from '../E2EE/keyManager';
import { useAuth } from './AuthContext';

export const ChatContext = createContext();

export const ChatContextProvider = ({ children }) => {
  const { user } = useAuth();
  const [userChats, setUserChats] = useState([]);
  const [isUserChatsLoading, setIsUserChatsLoading] = useState(false);
  const [userChatsError, setUserChatsError] = useState(null);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  
  const { socket, isConnected } = useContext(SocketContext);

  const currentChatRef = useRef(currentChat);
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  useEffect(() => {
    if (!socket || !user) return;
    
    const handleReceiveMessage = async (message) => {
      const currentChatMembers = currentChatRef.current?.members.map(m => m.id) || [];
      
      const isCurrentChat = currentChatMembers.includes(message.senderId) || 
                           currentChatMembers.includes(user.id);
      if (!isCurrentChat) return;

      await keyManager.ensureSessionFromPreKeyMessage(message);

      if (message.senderId === user.id) {
        console.warn('user received their own message:', message);
        return;
      }
      
      let decryptedText = '[Decryption failed]';
      let decryptionSucceeded = false;
        
      try {
        const messageToDecrypt = {
          encryptedContent: message.encryptedContent,
          type: message.type,
          senderId: message.senderId,
        };
        decryptedText = await keyManager.decryptMessage(String(message.senderId), messageToDecrypt);
        decryptionSucceeded = true;
      } catch (err) {
        console.error('Failed to decrypt incoming message:', err);
      }

      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        const updatedMessage = { ...message, text: decryptedText, decryptionSucceeded };
        return [...prev, updatedMessage];
      });
    };

    socket.on('receiveMessage', handleReceiveMessage);
    
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket, user]); 

  useEffect(() => {
    const getMessages = async () => {
      if (!currentChat || !user) return;

      const partnerId = currentChat.members.find(m => m.id !== user.id)?.id;
      if (!partnerId) return;

      setIsMessagesLoading(true);
      setMessagesError(null);

      try {
        const resp = await getRequest(`messages/${partnerId}`);
        if (resp.error) {
          setMessagesError(resp);
          setMessages([]);
          return;
        }

        const decryptedMessages = await Promise.all(
          resp.map(async (msg) => {
            try {
              if (msg.senderId === user.id) {
                const text = await keyManager.decryptWithStoredSessionKey(partnerId, {
                  encryptedContent: msg.encryptedContent
                });
                return { ...msg, text, decryptionSucceeded: true };
              } else {
                const messageToDecrypt = {
                  encryptedContent: msg.encryptedContent,
                  type: msg.type,
                  senderId: msg.senderId
                };
                const text = await keyManager.decryptMessage(String(msg.senderId), messageToDecrypt);
                return { ...msg, text, decryptionSucceeded: true };
              }
            } catch (err) {
              console.error('Decryption error for message:', msg.id, err);
              return { ...msg, text: '[Decryption failed]', decryptionSucceeded: false };
            }
          })
        );
        setMessages(decryptedMessages);
      } catch (error) {
        setMessagesError(error);
      } finally {
        setIsMessagesLoading(false);
      }
    };
    getMessages();
  }, [currentChat, user]);

  useEffect(() => {
    const getUserChats = async () => {
      if (!user?.id) return;
      
      setIsUserChatsLoading(true);
      setUserChatsError(null);
      
      try {
        const response = await getRequest(`chats/${user.id}`);
        if (response.error) {
          setUserChatsError(response);
          setUserChats([]);
        } else {
          setUserChats(response);
        }
      } catch (error) {
        setUserChatsError(error);
      } finally {
        setIsUserChatsLoading(false);
      }
    };
    getUserChats();
  }, [user]);

  const updateCurrentChat = useCallback((chat) => {
    setCurrentChat(chat);
  }, []);

  const createChat = useCallback(async (recipientId) => {
      if (!user || !recipientId) return;



      const existing = userChats.find(c => c.members.some(m => m.id === recipientId));
      if (existing) return updateCurrentChat(existing);

      const response = await postRequest('chats', { firstId: user.id, secondId: recipientId });
      if (response.error) return;
      
      setUserChats(prev => [...prev, response]);
      setCurrentChat(response);
    }, [user, userChats, updateCurrentChat]
  );

  const sendTextMessage = useCallback(async (text, setTextMessage) => {
      if (!socket || !isConnected || !currentChat || !user) return;

      const recipientId = currentChat.members.find(m => m.id !== user.id)?.id;
      if (!recipientId) return;

      try {
        const recipientIdStr = String(recipientId);
        if (!(await keyManager.hasSession(recipientIdStr))) {
          const bundleResp = await getRequest(`keys/bundle/${recipientIdStr}`);
          if (bundleResp.error) throw new Error(bundleResp.message);
          await keyManager.processPreKeyBundle(recipientIdStr, bundleResp);
        }

        const encrypted = await keyManager.encryptMessage(recipientIdStr, text);
        if (!encrypted.encryptedContent) throw new Error('Encryption returned empty content');
        
        const messageObj = {
          senderId: user.id,
          recipientId,
          tempId: `temp-${Date.now()}`,
          ...encrypted
        };
        
        socket.emit('sendMessage', messageObj);
        
        const tempMessage = { 
          id: messageObj.tempId,
          text, 
          senderId: user.id, 
          createdAt: new Date().toISOString(),
          decryptionSucceeded: true
        };
        
        setMessages(prev => [...prev, tempMessage]);
        setTextMessage('');
      } catch (err) {
        console.error("Failed to send message:", err);
      }
    }, [socket, isConnected, user, currentChat]
  );

  return (
    <ChatContext.Provider
      value={{
        userChats,
        isUserChatsLoading,
        userChatsError,
        messages,
        isMessagesLoading,
        messagesError,
        currentChat,
        updateCurrentChat,
        sendTextMessage,
        createChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};