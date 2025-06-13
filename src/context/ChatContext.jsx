import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
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
  const socketData = useContext(SocketContext);
  const socket = socketData?.socket;
  const isConnected = socketData?.isConnected;

  useEffect(() => {
    console.log('[ChatContext] Socket connection status:', isConnected ? 'Connected' : 'Disconnected');
  }, [isConnected]);

  useEffect(() => {
    if (!socket || !user || !isConnected) {
      console.log('[ChatContext] Not registering user - socket or user not ready');
      return;
    }
    
    console.log(`[ChatContext] Registering user ${user.id} with socket ${socket.id}`);
    socket.emit('registerUser', user.id);

    const handleMessageError = (error) => {
      console.error('[ChatContext] Message error received:', error);
      if (error.message) {
        console.error('[ChatContext] Error message:', error.message);
      }
      if (error.details) {
        console.error('[ChatContext] Error details:', error.details);
      }
    };

    socket.on('messageError', handleMessageError);
    
    return () => {
      socket.off('messageError', handleMessageError);
    };
  }, [socket, user, isConnected]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageSent = (receipt) => {
      console.log('[ChatContext] Message sent receipt received:', receipt);
    };

    socket.on('messageSent', handleMessageSent);
    
    return () => {
      socket.off('messageSent', handleMessageSent);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !user) return;
    
    const handleReceiveMessage = async (message) => {
      console.log('[ChatContext] Received message via socket:', message);
      
      try {
        const isCurrentChat = currentChat?.members.some(m => m.id === message.senderId);
        
        const messageToDecrypt = {
          encryptedContent: message.encryptedContent,
          type: message.type,
          senderId: message.senderId,
          dhPublicKey: message.dhPublicKey
        };
        
        console.log('[ChatContext] Attempting to decrypt message from:', message.senderId);
        const senderIdStr = String(message.senderId);
        
        const hasDecimal = senderIdStr.includes('.');
        if (hasDecimal) {
          console.warn(`[ChatContext] Decimal ID detected: ${senderIdStr}, may require special handling`);
        }
        
        if (message.type === 3) {
          console.log('[ChatContext] Received PreKey message, ensuring return session exists');
          try {
            const sessionEstablished = await keyManager.ensureSessionFromPreKeyMessage(message);
            console.log(`[ChatContext] Return session establishment ${sessionEstablished ? 'succeeded' : 'failed'}`);
            
            if (!sessionEstablished) {
              console.warn('[ChatContext] Failed to establish return session, decryption may fail');
            }
          } catch (sessionError) {
            console.error('[ChatContext] Error establishing return session:', sessionError);
          }
        }
        
        try {
          await keyManager.debugSessionInfo(senderIdStr);
        } catch (err) {
          console.log('[ChatContext] Debug info error during receive:', err);
        }
        
        const messageType = Number(message.type);
        if (messageType === 9999) {
          console.log('[ChatContext] Received fallback (unencrypted) message');
        }
        
        let decryptedText = '[Decryption failed]';
        let decryptionSucceeded = false;
        
        try {
          if (message.type === 3 && (!message.dhPublicKey || message.dhPublicKey === '')) {
            console.warn('[ChatContext] PreKey message is missing DH public key, checking localStorage');
            
            try {
              const storedKey = localStorage.getItem(`dhKey_${senderIdStr}`);
              if (storedKey) {
                console.log('[ChatContext] Found stored DH key in localStorage, using it for decryption');
                messageToDecrypt.dhPublicKey = storedKey;
              } else {
                console.warn('[ChatContext] No stored DH key found for sender', senderIdStr);
              }
            } catch (e) {
              console.error('[ChatContext] Error checking localStorage for DH key:', e);
            }
          }
          
          decryptedText = await keyManager.decryptMessage(senderIdStr, messageToDecrypt);
          decryptionSucceeded = true;
          console.log('[ChatContext] Successfully decrypted message:', decryptedText.substring(0, 20));
        } catch (err) {
          console.error('[ChatContext] Failed to decrypt incoming message:', err);
          
          decryptedText = '[Decryption failed]';

          if (err.message && err.message.includes('No session')) {
            console.log('[ChatContext] No session error detected, attempting to establish session');
            
            try {
              const sessionEstablished = await keyManager.ensureSessionFromPreKeyMessage(message);
              console.log(`[ChatContext] Session establishment ${sessionEstablished ? 'succeeded' : 'failed'}`);
              
              if (sessionEstablished) {
                try {
                  console.log('[ChatContext] Retrying decryption after session establishment');
                  decryptedText = await keyManager.decryptMessage(senderIdStr, messageToDecrypt);
                  decryptionSucceeded = true;
                  console.log('[ChatContext] Retry succeeded!');
                } catch (retryErr) {
                  console.error('[ChatContext] Retry decryption failed:', retryErr);
                  decryptedText = '[Decryption failed after session retry]';
                }
              } else {
                decryptedText = '[Session establishment failed]';
              }
            } catch (sessionErr) {
              console.error('[ChatContext] Session establishment failed:', sessionErr);
              decryptedText = '[Session establishment error]';
            }
          }
          else if (err.message && (err.message.includes('Base key session issue') || err.message.includes('unable to find session for base key'))) {
            console.log('[ChatContext] Base key session issue detected, attempting to rebuild session');
            
            try {
              await keyManager.removeSession(senderIdStr);
              console.log('[ChatContext] Removed problematic session');
              
              await new Promise(resolve => setTimeout(resolve, 200));
              
              const sessionEstablished = await keyManager.ensureSessionFromPreKeyMessage(message);
              console.log(`[ChatContext] Session rebuild for base key issue ${sessionEstablished ? 'succeeded' : 'failed'}`);
              
              if (sessionEstablished) {
                try {
                  console.log('[ChatContext] Retrying decryption after base key session rebuild');
                  decryptedText = await keyManager.decryptMessage(senderIdStr, messageToDecrypt);
                  decryptionSucceeded = true;
                  console.log('[ChatContext] Retry after base key fix succeeded!');
                } catch (retryErr) {
                  console.error('[ChatContext] Retry after base key fix failed:', retryErr);
                  decryptedText = '[Base key session issue]';
                }
              } else {
                decryptedText = '[Base key session rebuild failed]';
              }
            } catch (baseKeyErr) {
              console.error('[ChatContext] Base key session fix failed:', baseKeyErr);
              decryptedText = '[Base key session issue]';
            }
          }
          else if (err.message && err.message.includes('Incompatible version')) {
            console.log('[ChatContext] Version compatibility issue detected, attempting to rebuild session');
            
            try {
              await keyManager.removeSession(senderIdStr);
              console.log('[ChatContext] Removed problematic session');
              
              await new Promise(resolve => setTimeout(resolve, 200));
              
              const sessionEstablished = await keyManager.ensureSessionFromPreKeyMessage(message);
              console.log(`[ChatContext] Session rebuild ${sessionEstablished ? 'succeeded' : 'failed'}`);
              
              if (sessionEstablished) {
                try {
                  console.log('[ChatContext] Retrying decryption after session rebuild');
                  decryptedText = await keyManager.decryptMessage(senderIdStr, messageToDecrypt);
                  decryptionSucceeded = true;
                  console.log('[ChatContext] Retry after version fix succeeded!');
                } catch (retryErr) {
                  console.error('[ChatContext] Retry after version fix failed:', retryErr);
                  decryptedText = '[Version compatibility issue]';
                }
              } else {
                decryptedText = '[Version compatibility - session rebuild failed]';
              }
            } catch (versionErr) {
              console.error('[ChatContext] Version compatibility fix failed:', versionErr);
              decryptedText = '[Version compatibility issue]';
            }
          }
          else if (err.message && err.message.includes('Cannot read properties')) {
            console.error('[ChatContext] Likely Signal library initialization issue');
            decryptedText = '[Signal library error]';
          }
          else if (hasDecimal) {
            console.warn('[ChatContext] Decimal ID may be causing encryption issues');
            decryptedText = '[Decimal ID decryption issue]';
          }
          else {
            decryptedText = '[Decryption failed]';
          }
        }

        if (isCurrentChat) {
          console.log('[ChatContext] Adding message to current chat');
          setMessages(prev => {
            const messageExists = prev.some(m => m.id === message.id);
            if (messageExists) {
              return prev;
            }
            return [...prev, {
              ...message,
              text: decryptedText,
              decryptionSucceeded
            }];
          });
        } else {
          console.log('[ChatContext] Message not for current chat, could implement notification here');
        }
      } catch (err) {
        console.error('[ChatContext] Error processing received message:', err);
      }
    };

    console.log('[ChatContext] Registering receiveMessage handler with user ID:', user.id);
    socket.on('receiveMessage', handleReceiveMessage);
    
    return () => {
      console.log('[ChatContext] Unregistering receiveMessage handler');
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [socket, currentChat, user]);

  useEffect(() => {
    const getMessages = async () => {
      if (!currentChat || !user) return;

      const partnerId = currentChat.members.find(m => m.id !== user.id)?.id;
      if (!partnerId) return;

      console.log(`[ChatContext] Fetching messages with user ${partnerId}`);
      const resp = await getRequest(`messages/${partnerId}`);
      if (resp.error) {
        setMessages([]);
        return;
      }

      console.log(`[ChatContext] Fetched ${resp.length} messages from API`);
      
      if (resp.length === 0) {
        setMessages([]);
        return;
      }

      const decrypted = [];
      
      for (const msg of resp) {
        try {
          const partner = msg.senderId === user.id ? partnerId : msg.senderId;
          const partnerStr = String(partner);
          
          const messageToDecrypt = {
            encryptedContent: msg.encryptedContent,
            type: msg.type,
            senderId: partner
          };
          
          if (!messageToDecrypt.encryptedContent || typeof messageToDecrypt.encryptedContent !== 'string') {
            console.error(`[ChatContext] Invalid message content format for message ${msg.id}:`, 
              typeof messageToDecrypt.encryptedContent);
            decrypted.push({ ...msg, text: '[Invalid message format]', decryptionSucceeded: false });
            continue;
          }
          
          let text = '[Decryption failed]';
          let decryptionSucceeded = false;
          
          try {
            text = await keyManager.decryptMessage(partnerStr, messageToDecrypt);
            decryptionSucceeded = true;
          } catch (err) {
            console.error(`[ChatContext] Failed to decrypt message ${msg.id}:`, err);
            
            if (err.message && err.message.includes('No session')) {
              console.warn(`[ChatContext] Missing session for ${partnerStr}, may need to rebuild`);
              text = '[Missing session - decryption failed]';
            } else if (err.message && err.message.includes('Base key session issue')) {
              text = '[Base key session issue]';
            } else if (err.message && err.message.includes('Incompatible version')) {
              text = '[Version compatibility issue]';
            } else {
              text = '[Decryption failed]';
            }
          }
          
          decrypted.push({ ...msg, text, decryptionSucceeded });
        } catch (err) {
          console.error(`[ChatContext] Error processing message ${msg.id}:`, err);
          decrypted.push({ ...msg, text: '[Processing failed]', decryptionSucceeded: false });
        }
      }
      
      console.log(`[ChatContext] Processed ${decrypted.length} messages, setting to state`);
      setMessages(decrypted);
    };
    
    getMessages();
  }, [currentChat, user]);

  useEffect(() => {
    const getUserChats = async () => {
      if (!user?.id) return;
      setIsUserChatsLoading(true);
      setUserChatsError(null);
      const response = await getRequest(`chats/${user.id}`);
      setIsUserChatsLoading(false);
      if (response.error) {
        setUserChatsError(response);
      } else {
        setUserChats(response);
      }
    };
    getUserChats();
  }, [user]);

  const updateCurrentChat = useCallback(chat => {
    setCurrentChat(chat);
  }, []);

  const createChat = useCallback(
    async recipientIdStr => {
      if (!user || !recipientIdStr.trim()) return;
      const recipientId = parseInt(recipientIdStr, 10);
      if (isNaN(recipientId)) return;

      const findResp = await getRequest(`users/find/${recipientId}`);
      if (findResp.error) return;
      const recipient = findResp.user;
      if (recipient.id === user.id) return;

      const existing = userChats.find(c => c.members.some(m => m.id === recipient.id));
      if (existing) {
        updateCurrentChat(existing);
        return;
      }

      const createResp = await postRequest(`chats`, {
        firstId: user.id,
        secondId: recipient.id,
      });
      if (createResp.error) return;
      setUserChats(prev => [...prev, createResp]);
      setCurrentChat(createResp);
    },
    [user, userChats, updateCurrentChat]
  );

  const sendTextMessage = useCallback(
    async (text, setTextMessage) => {
      if (!socket || !isConnected || !currentChat || !user) {
        console.error('[ChatContext] Cannot send message - socket/chat not ready');
        if (!socket || !isConnected) alert('Connection to server lost. Please refresh the page.');
        return;
      }

      const recipientId = currentChat.members.find(m => m.id !== user.id)?.id;
      if (!recipientId) return;

      try {
        console.log(`[ChatContext] Attempting to send message to user ${recipientId}`);
        
        const recipientIdStr = String(recipientId);
        
        try {
          console.log(`[ChatContext] Debug session before any action:`);
          await keyManager.debugSessionInfo(recipientIdStr);
        } catch (err) {
          console.log('[ChatContext] Debug info error:', err);
        }

        const hasDecimal = recipientIdStr.includes('.');
        
        const establishSession = async (force = false) => {
          const sessionExists = !force && await keyManager.hasSession(recipientIdStr);
          if (force || !sessionExists) {
            console.log(`[ChatContext] ${force ? 'Forcing new' : 'No'} session, fetching PreKeyBundle for ${recipientIdStr}`);
            
            if (force) {
              try {
                await keyManager.removeSession(recipientIdStr);
                console.log(`[ChatContext] Removed existing session for ${recipientIdStr}`);
              } catch (err) {
                console.error('[ChatContext] Error removing session:', err);
              }
            }

            let retryCount = 0;
            const maxRetries = 2;
            
            while (retryCount <= maxRetries) {
              try {
                const bundleResp = await getRequest(`keys/bundle/${recipientIdStr}`);
                if (bundleResp.error) {
                  throw new Error(`Failed to fetch encryption keys: ${bundleResp.message}`);
                }
                
                console.log(`[ChatContext] Processing PreKeyBundle, attempt ${retryCount + 1}:`);
                console.log(JSON.stringify(bundleResp, null, 2));
                
                await keyManager.processPreKeyBundle(recipientIdStr, bundleResp);
                await new Promise(resolve => setTimeout(resolve, 300)); 
                
                const sessionVerified = await keyManager.hasSession(recipientIdStr);
                if (!sessionVerified) {
                  throw new Error('Session creation failed - session not found after processing');
                }
                
                await keyManager.debugSessionInfo(recipientIdStr);
                console.log(`[ChatContext] Session established for ${recipientIdStr}`);
                return true;
              } catch (err) {
                console.error(`[ChatContext] Attempt ${retryCount + 1} failed:`, err);
                
                if (retryCount >= maxRetries) {
                  throw new Error(`Failed to establish secure session after ${maxRetries + 1} attempts: ${err.message}`);
                }
                
                console.log(`[ChatContext] Retrying, attempt ${retryCount + 2}/${maxRetries + 1}...`);
                await new Promise(resolve => setTimeout(resolve, 500)); 
                retryCount++;
              }
            }
          }
          
          console.log(`[ChatContext] Using existing session for ${recipientIdStr}`);
          return true;
        };
        
        if (hasDecimal) {
          console.log(`[ChatContext] Decimal ID detected, forcing fresh session`);
          await establishSession(true); 
        } else {
          await establishSession(false);
        }

        await keyManager.debugSessionInfo(recipientIdStr);

        let encryptRetries = 0;
        const maxEncryptRetries = 1;
        
        while (encryptRetries <= maxEncryptRetries) {
          try {
            console.log(`[ChatContext] Encrypting message for ${recipientIdStr}, attempt ${encryptRetries + 1}`);
            const encrypted = await keyManager.encryptMessage(recipientIdStr, text);
            
            if (!encrypted.encryptedContent || encrypted.encryptedContent.length === 0) {
                throw new Error("Encryption returned empty content");
            }
            
            console.log(`[ChatContext] Message encrypted successfully, sending via socket`);
            const messageObj = {
              senderId: user.id,
              recipientId,
              tempId: `temp-${Date.now()}`,
              encryptedContent: encrypted.encryptedContent, 
              type: encrypted.type,
              messageIndex: encrypted.messageIndex || Date.now(),
              dhPublicKey: encrypted.dhPublicKey || '',
              prevChainLen: encrypted.prevChainLen || 0,
              registrationId: encrypted.registrationId
            };
            
            if (encrypted.type === 3 && (!encrypted.dhPublicKey || encrypted.dhPublicKey === '')) {
              console.warn('[ChatContext] WARNING: PreKey message missing DH public key, generating one');
              
              try {
                const getIdentityKey = async () => {
                  try {
                    const identityKeyPair = await keyManager.getIdentityKeyPair();
                    if (identityKeyPair && identityKeyPair.pubKey) {
                      const pubKeyBase64 = await keyManager.arrayBufferToBase64(identityKeyPair.pubKey);
                      console.log('[ChatContext] Using identity pubKey as DH key');
                      return pubKeyBase64;
                    }
                    return null;
                  } catch (err) {
                    console.error('[ChatContext] Error getting identity key:', err);
                    return null;
                  }
                };
                
                const identityKey = await getIdentityKey();
                if (identityKey) {
                  encrypted.dhPublicKey = identityKey;
                } else {
                  const randomBytes = new Uint8Array(33);
                  window.crypto.getRandomValues(randomBytes);
                  const randomKey = btoa(String.fromCharCode.apply(null, randomBytes));
                  encrypted.dhPublicKey = randomKey;
                  console.log('[ChatContext] Generated random DH key');
                }
                
                messageObj.dhPublicKey = encrypted.dhPublicKey;
              } catch (dhError) {
                console.error('[ChatContext] Failed to generate DH key:', dhError);
              }
            } else if (encrypted.type === 3 && encrypted.dhPublicKey) {
              try {
                localStorage.setItem(`dhKey_${recipientIdStr}`, encrypted.dhPublicKey);
                console.log('[ChatContext] Saved PreKey DH public key to localStorage for future decryption');
                
                localStorage.setItem(`dhKey_${user.id}`, encrypted.dhPublicKey);
                console.log('[ChatContext] Saved reverse mapping of DH key for when this user is the recipient');
                
                if (recipientIdStr.includes('.')) {
                  const integerPart = recipientIdStr.split('.')[0];
                  localStorage.setItem(`dhKey_${integerPart}`, encrypted.dhPublicKey);
                  console.log(`[ChatContext] Also saved DH key with integer ID: ${integerPart}`);
                }
                
                const userIdStr = String(user.id);
                if (userIdStr.includes('.')) {
                  const integerPart = userIdStr.split('.')[0];
                  localStorage.setItem(`dhKey_${integerPart}`, encrypted.dhPublicKey);
                  console.log(`[ChatContext] Also saved reverse mapping with integer ID: ${integerPart}`);
                }
              } catch (e) {
                console.error('[ChatContext] Failed to save DH key to localStorage:', e);
              }
            }
            
            console.log('[ChatContext] SENDING MESSAGE STRUCTURE:', JSON.stringify(messageObj));
            console.log('[ChatContext] Message has encryptedContent?', !!messageObj.encryptedContent);
            console.log('[ChatContext] Message type:', typeof messageObj.type, messageObj.type);
            console.log('[ChatContext] Message index:', typeof messageObj.messageIndex, messageObj.messageIndex);
            console.log('[ChatContext] DH public key:', messageObj.dhPublicKey ? 'Present' : 'Missing');
            
            socket.emit('sendMessage', messageObj);
            
            const tempMessage = { 
              id: `temp-${Date.now()}`,
              text, 
              senderId: user.id, 
              createdAt: new Date().toISOString() 
            };
            setMessages(prev => [...prev, tempMessage]);
            setTextMessage('');
            
            console.log(`[ChatContext] Message sent successfully`);
            return; 
          } catch (err) {
            console.error(`[ChatContext] Encryption attempt ${encryptRetries + 1} failed:`, err);
            
            const needsRebuild = 
              (err.message && (
                err.message.includes('No valid session') ||
                err.message.includes('No record') || 
                err.message.includes('needs to be rebuilt') || 
                err.message.includes('Invalid session') ||
                err.message.includes('is not valid JSON') || 
                err.message.includes('JSON')
              ));
              
            if (needsRebuild) {
              if (encryptRetries < maxEncryptRetries) {
                console.log(`[ChatContext] Session corrupted, will completely rebuild it`);
                try {
                  await keyManager.removeSession(recipientIdStr);
                  console.log(`[ChatContext] Removed broken session, establishing new one`);
                  
                  await new Promise(resolve => setTimeout(resolve, 200));
                  
                  await establishSession(true);
                  encryptRetries++;
                } catch (rebuildErr) {
                  console.error(`[ChatContext] Failed to rebuild session:`, rebuildErr);
                  throw new Error(`Failed to rebuild corrupted session: ${rebuildErr.message}`);
                }
              } else {
                throw new Error(`Failed to encrypt message after rebuilding session: ${err.message}`);
              }
            } else {
              throw err;
            }
          }
        }
      } catch (err) {
        console.error('Failed to send message:', err);
        alert(`Failed to send message: ${err.message}`);
      }
    },
    [socket, isConnected, user, currentChat]
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