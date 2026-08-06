import React, { useState } from "react";

export const MessageBubble = ({
  message,
  currentUser,
  onReply,
  onEdit,
  onDelete,
  isConsecutive = false,
  isFirstInGroup = true,
  targetUser = null,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.message || message.text || "");

  const senderId = message.senderId?._id || message.senderId;
  const isSender = senderId?.toString() === (currentUser._id || currentUser.id)?.toString();

  const formatMessageTimestamp = (createdAtString) => {
    if (!createdAtString) return "10:45 AM";
    const date = new Date(createdAtString);
    if (isNaN(date.getTime())) return "10:45 AM";
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (date.toDateString() === today.toDateString()) {
      return timeStr;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${timeStr}`;
    }
    const dateStr = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    return `${dateStr} ${timeStr}`;
  };

  const formattedTime = formatMessageTimestamp(message.createdAt);

  const renderStatusTicks = () => {
    if (!isSender) return null;
    const status = message.status || (message.isRead ? "seen" : "sent");
    if (status === "seen") {
      return (
        <span className="wa-tick wa-tick-seen" title="Seen">
          ✓✓
        </span>
      );
    }
    if (status === "delivered") {
      return (
        <span className="wa-tick wa-tick-delivered" title="Delivered">
          ✓✓
        </span>
      );
    }
    return (
      <span className="wa-tick wa-tick-sent" title="Sent">
        ✓
      </span>
    );
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.message) {
      onEdit(message._id, editText);
    }
    setIsEditing(false);
  };

  const attachment = message.attachment || (message.fileUrl ? { url: message.fileUrl } : null);
  const messageType = message.messageType || message.type || "text";

  return (
    <div
      className={`wa-message-row ${
        isSender ? "wa-message-outgoing" : "wa-message-incoming"
      } ${isConsecutive ? "wa-consecutive-row" : "wa-first-row"}`}
    >
      {/* Show Receiver Avatar only on the first message of a consecutive group */}
      {!isSender && (
        <div className="wa-bubble-avatar-col">
          {isFirstInGroup ? (
            <img
              src={targetUser?.avatar || "/default-avatar.png"}
              alt={targetUser?.name || "User"}
              className="wa-receiver-mini-avatar"
            />
          ) : (
            <div className="wa-avatar-placeholder" />
          )}
        </div>
      )}

      <div
        className={`wa-message-bubble ${
          isSender ? "wa-bubble-sender" : "wa-bubble-receiver"
        } ${isFirstInGroup ? "wa-bubble-has-tail" : "wa-bubble-no-tail"}`}
      >
        {/* Reply To Preview (only if message itself is NOT deleted for everyone) */}
        {!message.deletedEveryone && message.replyTo && (
          <div className="wa-reply-quote-box">
            <span className="wa-reply-quote-sender">
              {message.replyTo.senderId === currentUser._id ? "You" : "Reply"}
            </span>
            <p className="wa-reply-quote-text">
              {message.replyTo.deletedEveryone
                ? "🚫 This message was deleted"
                : message.replyTo.message ||
                  message.replyTo.text ||
                  `[${message.replyTo.messageType || "Attachment"}]`}
            </p>
          </div>
        )}

        {/* Message Actions Menu Trigger */}
        <div className="wa-bubble-menu-wrapper">
          <button className="wa-bubble-menu-btn" onClick={() => setShowMenu(!showMenu)}>
            <svg viewBox="0 0 18 18" width="14" height="14" fill="currentColor">
              <path d="M3.3 6.7l4.2 4.2 4.2-4.2 1.4 1.4-5.6 5.6-5.6-5.6z" />
            </svg>
          </button>
          {showMenu && (
            <div className="wa-bubble-dropdown" onMouseLeave={() => setShowMenu(false)}>
              <button
                onClick={() => {
                  setShowMenu(false);
                  onReply && onReply(message);
                }}
              >
                Reply
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(message.message || message.text || "");
                  }
                }}
              >
                Copy
              </button>

              {isSender && !message.deletedEveryone && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setIsEditing(true);
                  }}
                >
                  Edit
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete && onDelete(message._id, false);
                }}
              >
                Delete for Me
              </button>

              {isSender && !message.deletedEveryone && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDelete && onDelete(message._id, true);
                  }}
                >
                  Delete for Everyone
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  alert(`Sent: ${formattedTime}\nStatus: ${message.status || "sent"}\nID: ${message._id}`);
                }}
              >
                Message Info
              </button>
            </div>
          )}
        </div>

        {/* Deleted state */}
        {message.deletedEveryone ? (
          <p className="wa-deleted-text">
            <i>🚫 This message was deleted</i>
          </p>
        ) : (
          <>
            {/* Attachment Rendering */}
            {attachment && attachment.url && (
              <div className="wa-message-attachment-container">
                {messageType === "image" && (
                  <img src={attachment.url} alt="Attachment" className="wa-attachment-img" />
                )}
                {messageType === "video" && (
                  <video src={attachment.url} controls className="wa-attachment-video" />
                )}
                {messageType === "audio" && (
                  <audio src={attachment.url} controls className="wa-attachment-audio" />
                )}
                {(messageType === "document" || messageType === "file") && (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="wa-attachment-doc-card"
                  >
                    <span className="wa-doc-icon">📄</span>
                    <div className="wa-doc-info">
                      <span className="wa-doc-name">{attachment.name || "Document"}</span>
                      {attachment.size > 0 && (
                        <span className="wa-doc-size">
                          {(attachment.size / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  </a>
                )}
              </div>
            )}

            {/* Message Text / Edit Input */}
            {isEditing ? (
              <div className="wa-edit-container">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="wa-edit-input"
                  autoFocus
                />
                <div className="wa-edit-actions">
                  <button onClick={handleSaveEdit} className="wa-edit-save-btn">
                    Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="wa-edit-cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="wa-message-text">
                {message.message || message.text}
                {message.edited && <span className="wa-edited-label"> (edited)</span>}
              </p>
            )}
          </>
        )}

        {/* Footer info (Timestamp & Ticks) */}
        <div className="wa-message-meta">
          <span className="wa-message-time">{formattedTime}</span>
          {renderStatusTicks()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
