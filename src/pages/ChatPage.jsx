import React from "react";
import useSocket from "../hooks/useSocket";
import useChat from "../hooks/useChat";
import useCalls from "../hooks/useCalls";
import ChatLayout from "../components/chat/ChatLayout";
import "../styles/whatsapp.css";

export const ChatPage = ({ currentUser, token }) => {
  // Initialize Socket.IO connection
  useSocket(token);

  // Initialize Chat & Calls hooks
  const chatState = useChat(currentUser);
  const callState = useCalls(currentUser);

  return (
    <div className="wa-app-root">
      <ChatLayout
        currentUser={currentUser}
        chatState={chatState}
        callState={callState}
      />
    </div>
  );
};

export default ChatPage;
