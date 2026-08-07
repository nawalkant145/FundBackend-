import React, { useState, useRef } from "react";

// WhatsApp-style Call Log Card component (Screenshot 1)
const CallLogBubble = ({ message, isSender }) => {
  const text = message.message || message.text || "";
  const lower = text.toLowerCase();
  const isVideo = lower.includes("video") || text.includes("📹");
  const isMissed = lower.includes("missed");
  const isDeclined = lower.includes("declined") || lower.includes("rejected");

  let title = isVideo ? "Video call" : "Voice call";
  if (isMissed) title = isVideo ? "Missed video call" : "Missed voice call";

  // Format duration subtitle
  let subtitle = "Voice call";
  if (isMissed) {
    subtitle = "Missed";
  } else if (isDeclined) {
    subtitle = "Declined";
  } else {
    const match = text.match(/\((.*?)\)/);
    if (match && match[1]) {
      subtitle = match[1];
    } else {
      subtitle = isVideo ? "Video call" : "Voice call";
    }
  }

  return (
    <div className="wa-call-log-card">
      <div className={`wa-call-log-icon-circle ${isMissed ? "wa-icon-missed" : "wa-icon-normal"}`}>
        {isMissed ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#f44336">
            <path d="M19.59 7L12 14.59 6.41 9H11V7H3v8h2v-4.59l7 7 9-9z" />
          </svg>
        ) : isVideo ? (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#111827">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#111827">
            <path d="M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5H9z" />
          </svg>
        )}
      </div>
      <div className="wa-call-log-details">
        <span className="wa-call-log-title">{title}</span>
        <span className="wa-call-log-subtitle">{subtitle}</span>
      </div>
    </div>
  );
};

// WhatsApp-style Voice Note Player component (Screenshot 2)
const VoiceNoteBubble = ({ audioUrl, senderAvatar, senderName }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = (clickX / width) * duration;
    if (audioRef.current && isFinite(newTime)) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const fmtTime = (secs) => {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="wa-voicenote-card">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <div className="wa-voicenote-avatar-wrapper">
        <img
          src={senderAvatar || "/default-avatar.png"}
          alt={senderName || "User"}
          className="wa-voicenote-avatar"
        />
        <div className="wa-voicenote-mic-badge">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#fff">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </div>
      </div>

      <div className="wa-voicenote-content">
        <button className="wa-voicenote-play-btn" onClick={togglePlay} type="button">
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#111827">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#111827">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="wa-voicenote-waveform-container" onClick={handleSeek}>
          <div className="wa-voicenote-waveform">
            {[35, 60, 40, 80, 55, 95, 70, 45, 85, 50, 75, 65, 40, 90, 60, 80, 50, 70, 45, 85, 65, 90, 40, 75, 55, 80, 60, 45, 70, 50, 65, 40].map(
              (heightPct, idx) => {
                const barPct = (idx / 32) * 100;
                const isFilled = barPct <= progressPct;
                return (
                  <div
                    key={idx}
                    className={`wa-waveform-bar ${isFilled ? "filled" : ""}`}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              },
            )}
          </div>
          <div
            className="wa-voicenote-scrubber-dot"
            style={{ left: `${progressPct}%` }}
          />
        </div>
      </div>
      <div className="wa-voicenote-time">{fmtTime(currentTime || duration)}</div>
    </div>
  );
};

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
  const [isStarred, setIsStarred] = useState(message.isStarred || false);

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

  const isCallMessage =
    messageType === "system" ||
    messageType === "call" ||
    (typeof (message.message || message.text) === "string" &&
      ((message.message || message.text).includes("call") ||
        (message.message || message.text).includes("Call") ||
        (message.message || message.text).includes("📞") ||
        (message.message || message.text).includes("📹")));

  const isAudioMessage =
    messageType === "audio" ||
    (attachment && (attachment.mimeType?.startsWith("audio") || attachment.url?.match(/\.(mp3|wav|ogg|m4a|aac|webm)$/i)));

  const senderAvatar = isSender ? currentUser?.avatar : targetUser?.avatar;
  const senderName = isSender ? currentUser?.name : targetUser?.name;

  return (
    <div
      className={`wa-message-row ${
        isSender ? "wa-message-outgoing" : "wa-message-incoming"
      } ${isConsecutive ? "wa-consecutive-row" : "wa-first-row"}`}
    >
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
                  setIsStarred(!isStarred);
                }}
              >
                {isStarred ? "Unstar" : "Star"}
              </button>

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

        {message.deletedEveryone ? (
          <p className="wa-deleted-text">
            <i>🚫 This message was deleted</i>
          </p>
        ) : isCallMessage ? (
          /* Render WhatsApp Call Log Card (Screenshot 1) */
          <CallLogBubble message={message} isSender={isSender} />
        ) : isAudioMessage ? (
          /* Render WhatsApp Voice Note Card (Screenshot 2) */
          <VoiceNoteBubble
            audioUrl={attachment?.url || message.fileUrl}
            senderAvatar={senderAvatar}
            senderName={senderName}
          />
        ) : (
          <>
            {/* Attachment Rendering (Images/Videos/Docs) */}
            {attachment && attachment.url && (
              <div className="wa-message-attachment-container">
                {messageType === "image" && (
                  <img src={attachment.url} alt="Attachment" className="wa-attachment-img" />
                )}
                {messageType === "video" && (
                  <video src={attachment.url} controls className="wa-attachment-video" />
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
          {isStarred && (
            <span style={{ color: "#facc15", fontSize: "12px", marginRight: "3px" }} title="Starred">
              ★
            </span>
          )}
          <span className="wa-message-time">{formattedTime}</span>
          {renderStatusTicks()}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
