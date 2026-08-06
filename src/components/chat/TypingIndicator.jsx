import React from "react";

export const TypingIndicator = ({ userName = "User" }) => {
  return (
    <div className="wa-message-row wa-message-incoming wa-typing-row">
      <div className="wa-message-bubble wa-bubble-receiver wa-typing-bubble">
        <span className="wa-typing-label">{userName} is typing</span>
        <div className="wa-typing-dots">
          <span className="wa-typing-dot"></span>
          <span className="wa-typing-dot"></span>
          <span className="wa-typing-dot"></span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
