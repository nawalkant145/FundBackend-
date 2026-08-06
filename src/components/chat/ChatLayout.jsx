import React, { useState } from "react";
import ChatSidebar from "./ChatSidebar";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import EmptyState from "../common/EmptyState";
import CallHistory from "../calls/CallHistory";
import MediaGallery from "../media/MediaGallery";
import CallDetailsModal from "../calls/CallDetailsModal";
import ActiveCallModal from "../calls/ActiveCallModal";

export const ChatLayout = ({
  currentUser,
  chatState,
  callState,
}) => {
  const [activeTab, setActiveTab] = useState("chats");
  const [showSearchBox, setShowSearchBox] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  const {
    chats,
    activeChat,
    messages,
    hasMoreMessages,
    replyingTo,
    searchQuery,
    setSearchQuery,
    setReplyingTo,
    selectChat,
    sendMessage,
    editMessage,
    deleteMessage,
    sendTyping,
    sendStopTyping,
    loadMoreMessages,
    typingUsers,
  } = chatState;

  const {
    callLogs,
    filter,
    setFilter,
    selectedCall,
    setSelectedCall,
    incomingCall,
    activeCall,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    setIsSpeakerOn,
  } = callState;

  const isCurrentChatTyping =
    activeChat &&
    Object.keys(typingUsers).some(
      (userId) => typingUsers[userId] && userId !== currentUser?._id,
    );

  const filteredMessages = chatSearchQuery.trim()
    ? messages.filter((m) =>
        (m.message || m.text || "")
          .toLowerCase()
          .includes(chatSearchQuery.toLowerCase().trim()),
      )
    : messages;

  const isFounder =
    activeChat &&
    (activeChat.founderId?._id === currentUser?._id ||
      activeChat.founderId === currentUser?._id);

  const targetUser = activeChat
    ? isFounder
      ? activeChat.investorId
      : activeChat.founderId
    : null;

  return (
    <div className="wa-app-layout">
      {/* Left Sidebar */}
      <ChatSidebar
        currentUser={currentUser}
        chats={chats}
        activeChat={activeChat}
        onSelectChat={(chat) => {
          selectChat(chat);
          setActiveTab("chats");
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Right Panel */}
      <main className="wa-main-panel">
        {activeTab === "chats" && (
          <>
            {activeChat ? (
              <div className="wa-chat-container">
                <ChatHeader
                  chat={activeChat}
                  currentUser={currentUser}
                  targetUser={targetUser}
                  onStartVoiceCall={(targetId, name, avatar) =>
                    startCall(targetId, "voice", name, avatar)
                  }
                  onStartVideoCall={(targetId, name, avatar) =>
                    startCall(targetId, "video", name, avatar)
                  }
                  onToggleSearch={() => setShowSearchBox(!showSearchBox)}
                  isTyping={isCurrentChatTyping}
                />

                {/* Inline Message Search Bar */}
                {showSearchBox && (
                  <div className="wa-chat-search-bar">
                    <input
                      type="text"
                      placeholder="Search in conversation..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      className="wa-search-in-chat-input"
                    />
                    <button
                      className="wa-close-search-btn"
                      onClick={() => {
                        setShowSearchBox(false);
                        setChatSearchQuery("");
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Show large profile intro card ONLY if NO messages exist */}
                {filteredMessages.length === 0 && (
                  <div className="wa-empty-chat-profile-card">
                    <img
                      src={targetUser?.avatar || "/default-avatar.png"}
                      alt={targetUser?.name || "User"}
                      className="wa-profile-card-avatar"
                    />
                    <h3>{targetUser?.name || targetUser?.username}</h3>
                    <p>End-to-end encrypted chat</p>
                  </div>
                )}

                <MessageList
                  messages={filteredMessages}
                  currentUser={currentUser}
                  targetUser={targetUser}
                  onReply={setReplyingTo}
                  onEdit={editMessage}
                  onDelete={deleteMessage}
                  hasMore={hasMoreMessages}
                  onLoadMore={loadMoreMessages}
                  isTyping={isCurrentChatTyping}
                />

                <MessageInput
                  chatId={activeChat._id}
                  onSendMessage={sendMessage}
                  replyingTo={replyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  onTyping={sendTyping}
                  onStopTyping={sendStopTyping}
                />
              </div>
            ) : (
              <EmptyState />
            )}
          </>
        )}

        {/* Calls Tab */}
        {activeTab === "calls" && (
          <CallHistory
            callLogs={callLogs}
            filter={filter}
            onFilterChange={setFilter}
            onSelectCallLog={setSelectedCall}
            onStartCall={(targetId, type, name, avatar) =>
              startCall(targetId, type, name, avatar)
            }
          />
        )}

        {/* Media Gallery Tab */}
        {activeTab === "media" && (
          <MediaGallery activeChatId={activeChat?._id} />
        )}
      </main>

      {/* Call Details Modal */}
      {selectedCall && (
        <CallDetailsModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onStartVoiceCall={(targetId, name, avatar) => {
            setSelectedCall(null);
            startCall(targetId, "voice", name, avatar);
          }}
          onStartVideoCall={(targetId, name, avatar) => {
            setSelectedCall(null);
            startCall(targetId, "video", name, avatar);
          }}
          onMessageUser={(chat) => {
            setSelectedCall(null);
            setActiveTab("chats");
            if (chat) selectChat(chat);
          }}
        />
      )}

      {/* Active / Incoming Call Modal Overlay */}
      {(incomingCall || activeCall) && (
        <ActiveCallModal
          incomingCall={incomingCall}
          activeCall={activeCall}
          callDuration={callDuration}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isSpeakerOn={isSpeakerOn}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={endCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleSpeaker={() => setIsSpeakerOn(!isSpeakerOn)}
        />
      )}
    </div>
  );
};

export default ChatLayout;
