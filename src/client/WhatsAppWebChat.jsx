import React from "react";
import ChatPage from "../pages/ChatPage";

export const WhatsAppWebChat = ({ currentUser, token }) => {
  return <ChatPage currentUser={currentUser} token={token} />;
};

export default WhatsAppWebChat;
