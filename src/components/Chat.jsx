import React from 'react';
import ChatWindow from '../components/ChatWindow';

const Chat = () => {
  return (
    <div className="d-flex" style={{ height: 'calc(100vh - 60px)' }}>
      <ChatWindow />
    </div>
  );
};

export default Chat;
