import React, { useContext, useState } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getRecipientUser } from '../../utils/chatUtils';
import { Search } from 'lucide-react';

const UserList = () => {
    const { user } = useAuth();
    const { userChats, isUserChatsLoading, updateCurrentChat, currentChat, createChat } = useContext(ChatContext);
    const [searchId, setSearchId] = useState("");

    const handleCreateChat = (e) => {
        e.preventDefault();
        if (!searchId.trim()) return;
        
        createChat(searchId);
        setSearchId(""); 
    };

    return (
        <div className="w-1/4 bg-card border-r border-border p-4 flex flex-col">
            <h2 className="text-xl font-semibold mb-4">Chats</h2>

            <form onSubmit={handleCreateChat} className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text" 
                        placeholder="Start chat by User ID..." 
                        className="w-full bg-input border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                    />
                </div>
                <button
                    type="submit"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                    Start
                </button>
            </form>
            
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-3">
                    {isUserChatsLoading && <p className="text-muted-foreground text-sm">Loading chats...</p>}
                    
                    {userChats && userChats.length > 0 ? (
                        userChats.map((chat, index) => {
                            const recipient = getRecipientUser(chat, user);
                            return (
                                <div
                                    key={index}
                                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                        currentChat?.id === chat.id ? 'bg-primary/10' : 'hover:bg-muted'
                                    }`}
                                    onClick={() => updateCurrentChat(chat)}
                                >
                                    <span className="font-medium text-sm">
                                        {recipient ? recipient.name : 'Unknown User'}
                                    </span>
                                </div>
                            );
                        })
                    ) : (
                        !isUserChatsLoading && <p className="text-muted-foreground text-center text-sm mt-4">No conversations yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserList;