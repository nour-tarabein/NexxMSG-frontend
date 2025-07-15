import React, { useContext, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import moment from 'moment';
import { Search, MessageSquarePlus } from 'lucide-react';

import { ChatContext } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { getRecipientUser } from '../../utils/chatUtils';

const ORANGE_SOLID = 'hsl(25, 95%, 55%)';

const itemVariants = {
  initial:  { rotateX:  0, opacity: 1 },
  hovered:  { rotateX: -90, opacity: 0 },
  selected: { rotateX: -90, opacity: 0 },
};

const backVariants = {
  initial:  { rotateX:  90, opacity: 0 },
  hovered:  { rotateX:   0, opacity: 1 },
  selected: { rotateX:   0, opacity: 1 },
};

const sharedTransition = {
  type: 'spring',
  stiffness: 100,
  damping: 20,
  duration: 0.5,
};

const ChatItemContent = ({ chat, user, isSelected }) => {
  const recipient = getRecipientUser(chat, user);
  const textColor      = isSelected ? 'text-primary-foreground'    : 'text-foreground';
  const mutedTextColor = isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground';

  return (
    <div className="flex-grow overflow-hidden">
      <div className="flex justify-between items-baseline">
        <p className={`font-bold truncate ${textColor}`}>
          {recipient?.name || 'Unknown User'}
        </p>
        <p className={`text-xs flex-shrink-0 ${mutedTextColor}`}>
          {moment(chat.updatedAt).format('h:mm A')}
        </p>
      </div>
      <p className={`text-sm truncate ${mutedTextColor}`}>
        {chat.lastMessage?.text || 'No messages yet...'}
      </p>
    </div>
  );
};

const ChatItem = ({ chat, user, isSelected, updateCurrentChat }) => {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });
  const itemRef = useRef(null);

  const handleMouseMove = (e) => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePosition({ x, y });
    }
  };

  const createDynamicGradient = (x, y) => {
    return `radial-gradient(circle at ${x}% ${y}%, rgba(249,115,22,0.6) 10%, rgba(249,115,22,0.4) 30%, rgba(234,88,12,0.15) 90%)`;
  };

  return (
    <motion.div
      ref={itemRef}
      className="relative w-full rounded-2xl overflow-visible"
      style={{ perspective: '600px' }}
      initial="initial"
      animate={isSelected ? 'selected' : 'initial'}
      whileHover="hovered"
      onMouseMove={handleMouseMove}
      onClick={() => updateCurrentChat(chat)}
    >
      <motion.div
        className="relative z-10 flex items-center p-3 bg-card rounded-2xl backface-hidden"
        variants={itemVariants}
        transition={sharedTransition}
        style={{
          transformStyle:  'preserve-3d',
          transformOrigin: 'center bottom',
        }}
      >
        <ChatItemContent chat={chat} user={user} isSelected={false} />
      </motion.div>

      <motion.div
        className="absolute inset-0 z-10 flex items-center p-3 rounded-2xl backface-hidden"
        variants={backVariants}
        transition={sharedTransition}
        style={{
          transformStyle:  'preserve-3d',
          transformOrigin: 'center top',
          background: isSelected 
            ? ORANGE_SOLID 
            : createDynamicGradient(mousePosition.x, mousePosition.y),
        }}
      >
        <ChatItemContent chat={chat} user={user} isSelected={isSelected} />
      </motion.div>
    </motion.div>
  );
};

export default function UserList() {
  const { user } = useAuth();
  const { userChats, isUserChatsLoading, updateCurrentChat, currentChat, createChat } =
    useContext(ChatContext);
  const [searchId, setSearchId] = useState('');

  const handleCreateChat = e => {
    e.preventDefault();
    if (!searchId.trim() || !createChat) return;
    createChat(searchId);
    setSearchId('');
  };

  return (
    <aside className="w-1/3 flex-shrink-0 border-r border-border bg-secondary/30 p-6 flex flex-col">
      <h1 className="text-2xl font-bold text-foreground mb-6">Chats</h1>

      <form onSubmit={handleCreateChat} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Start new chat by User ID..."
            className="w-full bg-card border-none rounded-full pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
          />
        </div>
      </form>

      <div className="flex-1 overflow-y-auto -mr-4 pr-4 space-y-3">
        {isUserChatsLoading && (
          <p className="text-muted-foreground text-sm text-center">Loading chats...</p>
        )}

        {userChats?.map(chat => {
          const isSelected = currentChat?.id === chat.id;
          return (
            <ChatItem
              key={chat.id}
              chat={chat}
              user={user}
              isSelected={isSelected}
              updateCurrentChat={updateCurrentChat}
            />
          );
        })}

        {!isUserChatsLoading && !userChats?.length && (
          <div className="text-center text-muted-foreground mt-10">
            <MessageSquarePlus className="mx-auto h-10 w-10 mb-2" />
            <p>No conversations yet.</p>
          </div>
        )}
      </div>
    </aside>
  );
}