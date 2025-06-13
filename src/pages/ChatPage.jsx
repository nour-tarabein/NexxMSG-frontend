import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ChatContextProvider } from '../context/ChatContext';
import UserList from '../components/Chat/UserList';
import ChatWindow from '../components/Chat/ChatWindow';
import { Navigate } from 'react-router-dom';

const ChatPage = () => {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" />;
    }

    return (
        <ChatContextProvider user={user}>
            <div className="flex h-[calc(100vh-100px)]">
                <UserList />
                <ChatWindow />
            </div>
        </ChatContextProvider>
    );
};

export default ChatPage;