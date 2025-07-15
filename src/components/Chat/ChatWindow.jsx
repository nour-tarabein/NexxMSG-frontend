// src/components/ChatWindow.js
import React, { useContext, useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, MessageSquarePlus } from 'lucide-react';
import { ChatContext } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import moment from 'moment';
import { getRecipientUser } from '../../utils/chatUtils';

export default function ChatWindow() {
  const { user } = useAuth();
  const { currentChat, messages, isMessagesLoading, sendTextMessage } =
    useContext(ChatContext);
  const [textMessage, setTextMessage] = useState('');
  const [expandedMessages, setExpandedMessages] = useState(new Set());
  const scroll = useRef();

  useEffect(() => {
    scroll.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const recipient = currentChat ? getRecipientUser(currentChat, user) : null;

  if (!currentChat) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="p-5 bg-card rounded-full">
            <MessageSquarePlus className="h-12 w-12 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground">
            Welcome to Your Inbox
          </h3>
          <p className="text-muted-foreground max-w-xs">
            Select a conversation from the left panel to start messaging.
          </p>
        </div>
      </div>
    );
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Loading Chat...
      </div>
    );
  }

  const handleSend = () => {
    if (!textMessage.trim()) return;
    sendTextMessage(textMessage, setTextMessage);
  };

  const toggleMessageExpansion = (messageId) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const isMessageLong = (text) => text.length > 150;
  const truncateMessage = (text) => text.substring(0, 150) + '...';

  return (
    <div className="flex-1 flex flex-col bg-background">
      <header className="flex items-center p-4 border-b bg-card">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {recipient?.name}
          </h2>
          <p className="text-sm text-green-500 flex items-center gap-1.5">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            Online
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages?.map((message) => {
          const isSender = message.senderId === user?.id;
          const messageId = message.id || message.tempId;
          const isExpanded = expandedMessages.has(messageId);
          const isLong = isMessageLong(message.text);
          const displayText = isLong && !isExpanded ? truncateMessage(message.text) : message.text;
          
          return (
            <div
              key={messageId}
              ref={scroll}
              className={`flex ${
                isSender ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`min-w-0 px-5 py-3 rounded-3xl shadow-sm transition-all duration-200 ${
                  isSender
                    ? 'text-white rounded-br-md max-w-md'
                    : 'bg-card text-foreground rounded-bl-md max-w-md'
                } ${isLong ? 'cursor-pointer hover:shadow-md' : ''}`}
                style={
                  isSender
                    ? { background: 'hsl(25, 95%, 55%)' }
                    : undefined
                }
                onClick={() => isLong && toggleMessageExpansion(messageId)}
              >
                <p className="text-sm leading-relaxed break-words">{displayText}</p>
                {isLong && (
                  <p className={`text-xs mt-1 ${isSender ? 'text-white/70' : 'text-muted-foreground'}`}>
                    {isExpanded ? 'Click to collapse' : 'Click to expand'}
                  </p>
                )}
                <span className="text-xs opacity-70 mt-2 block text-right">
                  {moment(message.createdAt).format('h:mm A')}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 pt-2">
        <div className="bg-card p-2 border rounded-full flex items-center gap-2 shadow-sm">
          <button className="p-3 text-muted-foreground hover:text-primary-foreground rounded-full transition-colors">
            <Smile className="h-5 w-5" />
          </button>
          <input
            type="text"
            value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 bg-transparent focus:outline-none placeholder:text-muted-foreground text-sm"
          />
          <button className="p-3 text-muted-foreground hover:text-primary-foreground rounded-full transition-colors">
            <Paperclip className="h-5 w-5" />
          </button>
          <div 
            className="relative rounded-full"
            style={{ perspective: '200px' }}
          >
            <button
              onClick={handleSend}
              className="relative z-10 p-3 rounded-full transition-all duration-300 ease-out hover:rotateX-90 hover:opacity-0"
              style={{ 
                background: 'hsl(25, 95%, 55%)', 
                color: '#fff',
                transformStyle: 'preserve-3d',
                transformOrigin: 'center bottom'
              }}
            >
              <Send className="h-5 w-5" />
            </button>

            <button
              onClick={handleSend}
              className="absolute inset-0 p-3 rounded-full transition-all duration-300 ease-out rotateX-90 opacity-0 hover:rotateX-0 hover:opacity-100"
              style={{ 
                background: 'hsl(15, 100%, 65%)', 
                color: '#fff',
                transformStyle: 'preserve-3d',
                transformOrigin: 'center top'
              }}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}