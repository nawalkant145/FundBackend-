import React, { useRef, useEffect } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";

function formatDateSeparator(dateString) {
  if (!dateString) return "Today";
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export const MessageList = ({
  messages,
  currentUser,
  targetUser,
  onReply,
  onEdit,
  onDelete,
  hasMore,
  onLoadMore,
  loadingMore,
  isTyping,
}) => {
  const containerRef = useRef(null);

  // Auto-scroll to bottom on chat open, new message arrival, or typing state change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isTyping]);

  const handleScroll = () => {
    if (containerRef.current && containerRef.current.scrollTop === 0 && hasMore && !loadingMore) {
      onLoadMore();
    }
  };

  // Group messages by Date & calculate consecutive flags
  const groupedMessages = [];
  let currentDate = null;

  messages.forEach((msg, index) => {
    const rawDate = msg.createdAt || Date.now();
    const msgDate = new Date(rawDate).toDateString();

    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({
        type: "date_separator",
        date: rawDate,
        id: `date_${msgDate}_${msg._id}`,
      });
    }

    const prevMsg = messages[index - 1];
    const isSameSenderAsPrev =
      prevMsg &&
      (prevMsg.senderId?._id || prevMsg.senderId)?.toString() ===
        (msg.senderId?._id || msg.senderId)?.toString();

    const timeDiffMs = prevMsg ? new Date(msg.createdAt) - new Date(prevMsg.createdAt) : 0;
    const isConsecutive = isSameSenderAsPrev && timeDiffMs < 5 * 60 * 1000;

    groupedMessages.push({
      type: "message",
      data: msg,
      id: msg._id,
      isConsecutive,
      isFirstInGroup: !isConsecutive,
    });
  });

  return (
    <div className="wa-message-list-container" ref={containerRef} onScroll={handleScroll}>
      {loadingMore && (
        <div className="wa-loading-more-spinner">
          <span>Loading earlier messages...</span>
        </div>
      )}

      {groupedMessages.map((item) => {
        if (item.type === "date_separator") {
          return (
            <div key={item.id} className="wa-date-separator-wrapper">
              <span className="wa-date-separator-pill">
                {formatDateSeparator(item.date)}
              </span>
            </div>
          );
        }
        return (
          <MessageBubble
            key={item.id}
            message={item.data}
            currentUser={currentUser}
            targetUser={targetUser}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            isConsecutive={item.isConsecutive}
            isFirstInGroup={item.isFirstInGroup}
          />
        );
      })}

      {isTyping && <TypingIndicator userName={targetUser?.name || "User"} />}
    </div>
  );
};

export default MessageList;
