import React, { useState, useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import chatApi from "../../services/chatApi";

export const MessageInput = ({
  chatId,
  onSendMessage,
  replyingTo,
  onCancelReply,
  onTyping,
  onStopTyping,
}) => {
  const [text, setText] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Outside click listener to dismiss emoji picker
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target) &&
        !e.target.closest(".wa-emoji-trigger-btn")
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    onTyping();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onStopTyping();
    }, 1500);
  };

  const handleSend = () => {
    if (!text.trim() && !isUploading) return;
    onSendMessage({ message: text.trim(), messageType: "text" });
    setText("");
    setShowEmojiPicker(false);
    onStopTyping();
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;

    setIsUploading(true);
    setShowAttachMenu(false);
    try {
      const res = await chatApi.uploadAttachment(chatId, file);
      onSendMessage({
        message: text.trim() || res.attachment.name || "Attachment",
        messageType: res.messageType || res.type,
        attachment: res.attachment,
      });
      setText("");
    } catch (err) {
      console.error("Failed to upload file:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEmojiSelect = (emojiData) => {
    const emoji = emojiData.emoji;
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
      }, 0);
    } else {
      setText((prev) => prev + emoji);
    }
  };

  return (
    <div className="wa-message-input-container">
      {/* Replying Banner */}
      {replyingTo && (
        <div className="wa-input-reply-banner">
          <div className="wa-reply-banner-content">
            <span className="wa-reply-banner-title">
              Replying to {replyingTo.senderId === "self" ? "yourself" : "message"}
            </span>
            <p className="wa-reply-banner-text">
              {replyingTo.message || replyingTo.text || `[${replyingTo.messageType || "Attachment"}]`}
            </p>
          </div>
          <button className="wa-reply-cancel-btn" onClick={onCancelReply}>
            ✕
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="wa-attachment-popup" onMouseLeave={() => setShowAttachMenu(false)}>
          <label className="wa-attach-option">
            <span>📷 Image / Video</span>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              hidden
              ref={fileInputRef}
            />
          </label>
          <label className="wa-attach-option">
            <span>📄 Document / PDF</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              hidden
            />
          </label>
          <label className="wa-attach-option">
            <span>🎵 Audio File</span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              hidden
            />
          </label>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="wa-emoji-picker-wrapper" ref={emojiPickerRef}>
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            searchDisabled={false}
            skinTonesDisabled
            width={340}
            height={400}
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      <div className="wa-input-row">
        {/* Emoji Button */}
        <button
          className="wa-input-icon-btn wa-emoji-trigger-btn"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          title="Emojis"
        >
          😀
        </button>

        {/* Attachment Button */}
        <button
          className="wa-input-icon-btn"
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          title="Attach file"
        >
          📎
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyPress}
          placeholder="Type a message"
          className="wa-chat-input-field"
          disabled={isUploading}
        />

        {/* Send or Voice Record Button */}
        {text.trim() || isUploading ? (
          <button className="wa-send-btn" onClick={handleSend} disabled={isUploading}>
            {isUploading ? "..." : "➤"}
          </button>
        ) : (
          <button className="wa-input-icon-btn" title="Voice Message">
            🎙️
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
