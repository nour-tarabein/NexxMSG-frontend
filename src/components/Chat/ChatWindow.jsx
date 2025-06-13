import React, { useContext, useState, useRef, useEffect } from 'react';
import { Send, Paperclip, AlertTriangle } from 'lucide-react';
import { ChatContext } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import moment from 'moment';

const ChatWindow = () => {
    const { user } = useAuth();
    const { currentChat, messages, isMessagesLoading, sendTextMessage } = useContext(ChatContext);
    const [textMessage, setTextMessage] = useState('');
    const scroll = useRef();

    useEffect(() => {
        scroll.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!currentChat) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Select a conversation to start messaging.
            </div>
        );
    }

    if (isMessagesLoading) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Loading chat...
            </div>
        );
    }

    const handleSend = () => {
        if (!textMessage.trim()) return;
        sendTextMessage(textMessage, setTextMessage);
    };

    const renderMessageContent = (message) => {
        if (message.text && message.text.startsWith('[') && message.text.endsWith(']') && !message.decryptionSucceeded) {
            return (
                <div className="flex items-center gap-2 text-amber-500">
                    <AlertTriangle size={16} />
                    <span>{message.text}</span>
                </div>
            );
        }
        
        return <p>{message.text}</p>;
    };

    return (
        <div className="flex-1 flex flex-col p-4 bg-background">
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
                {messages && messages.map((message, index) => (
                    <div
                        key={index}
                        ref={scroll}
                        className={`flex items-end gap-2 ${
                            message.senderId === user?.id ? 'justify-end' : 'justify-start'
                        }`}
                    >
                        <div
                            className={`max-w-md p-3 rounded-xl ${
                                message.senderId === user?.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card border border-border'
                            }`}
                        >
                            {renderMessageContent(message)}
                            <span className="text-xs opacity-70 mt-1 block text-right">
                                {moment(message.createdAt).calendar()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2 bg-card p-3 border border-border rounded-xl">
                <button className="p-2 hover:bg-muted rounded-full">
                    <Paperclip className="h-5 w-5 text-muted-foreground" />
                </button>
                <input
                    type="text"
                    value={textMessage}
                    onChange={(e) => setTextMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent focus:outline-none"
                />
                <button
                    onClick={handleSend}
                    className="p-3 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
                >
                    <Send className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

export default ChatWindow;