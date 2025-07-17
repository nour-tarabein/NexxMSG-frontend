import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Plus, 
  Users, 
  Search, 
  Settings, 
  Bell,
  Star,
  Clock,
  UserPlus,
  ArrowRight,
  Zap,
  Shield,
  Smile,
  LogOut,
  Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatContext } from '../context/ChatContext';
import { getRecipientUser } from '../utils/chatUtils';
import ThemeToggle from '../components/ThemeToggle';
import moment from 'moment';

export default function Homepage() {
  const { user, logout } = useAuth();
  const { userChats, isUserChatsLoading, createChat, updateCurrentChat } = useContext(ChatContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const navigate = useNavigate();

  const recentChats = userChats?.slice(0, 5) || [];
  
  const totalFriends = userChats?.length || 0;
  
  const totalMessagesSent = userChats?.reduce((total, chat) => {
    return total + (chat.messagesSent || 0);
  }, 0) || 0;

  const handleStartChat = async () => {
    if (searchQuery.trim()) {
      await createChat(searchQuery);
      navigate('/chat');
      setSearchQuery('');
    }
  };

  const handleChatClick = (chat) => {
    updateCurrentChat(chat);
    navigate('/chat');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 transition-colors duration-500">
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="relative">
                <MessageCircle className="h-8 w-8 text-orange-500" />
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl dark:bg-orange-400/30"></div>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                NexxMSG
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <button className="relative p-2 text-slate-600 dark:text-slate-300 hover:text-orange-500 dark:hover:text-orange-400 transition-colors">
                <Bell className="h-5 w-5" />
              </button>

              <ThemeToggle />

              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 hidden sm:block">
                    {user?.name || 'User'}
                  </span>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-2 z-50">
                    <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{user?.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                    </div>
                    <button className="w-full px-4 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-8"
        >
          <motion.div variants={itemVariants} className="text-center space-y-4">
            <h1 className="text-4xl font-bold">
              <span className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                Welcome back, 
              </span>
              <span className="bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-400 dark:to-orange-500 bg-clip-text text-transparent ml-2">
                {user?.name?.split(' ')[0] || 'User'}!
              </span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300">
              You have {userChats?.length || 0} conversations and {totalMessagesSent} messages sent
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Recent Conversations</h2>
              {userChats?.length > 5 && (
                <Link to="/chat" className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 text-sm font-medium">
                  View all
                </Link>
              )}
            </div>

            {isUserChatsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white/80 dark:bg-slate-800/80 rounded-2xl p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentChats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentChats.map((chat) => {
                  const recipient = getRecipientUser(chat, user);
                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleChatClick(chat)}
                      className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 hover:shadow-lg dark:hover:shadow-slate-900/25 transition-all duration-200 text-left hover:border-orange-300 dark:hover:border-orange-500/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                          {recipient?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {recipient?.name || 'Unknown User'}
                            </h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {moment(chat.updatedAt || chat.createdAt).fromNow()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                            {chat.lastMessage?.text || 'No messages yet...'}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageCircle className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No conversations yet</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Start your first conversation!</p>
                <Link
                  to="/chat"
                  className="inline-flex px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Start Chatting
                </Link>
              </div>
            )}
          </motion.div>

          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-orange-500">{userChats?.length || 0}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Chats</div>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{totalFriends}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Total Friends</div>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-500 flex items-center justify-center gap-1">
                <Send className="h-5 w-5" />
                {totalMessagesSent}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Messages Sent</div>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}