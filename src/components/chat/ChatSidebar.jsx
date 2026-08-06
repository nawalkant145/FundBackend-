import React from "react";
import SearchBar from "../common/SearchBar";
import Tabs from "../common/Tabs";

export const ChatSidebar = ({
  currentUser,
  chats,
  activeChat,
  onSelectChat,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  unreadCount = 0,
}) => {
  const filteredChats = chats.filter((c) => {
    const isFounder = c.founderId?._id === currentUser?._id || c.founderId === currentUser?._id;
    const targetUser = isFounder ? c.investorId : c.founderId;
    const name = targetUser?.name || targetUser?.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <aside className="wa-sidebar">
      {/* Sidebar Header */}
      <div className="wa-sidebar-header">
        <div className="wa-user-profile-summary">
          <img
            src={currentUser?.avatar || "/default-avatar.png"}
            alt={currentUser?.name || "User"}
            className="wa-sidebar-user-avatar"
          />
          <span className="wa-sidebar-user-name">{currentUser?.name || "My Account"}</span>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChange={onSearchChange}
        placeholder="Search or start new chat"
      />

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        unreadChatCount={unreadCount}
      />

      {/* Chat Conversations List */}
      {activeTab === "chats" && (
        <div className="wa-chat-list">
          {filteredChats.length === 0 ? (
            <div className="wa-no-chats-found">
              <span>No conversations found</span>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isFounder =
                chat.founderId?._id === currentUser?._id ||
                chat.founderId === currentUser?._id;
              const targetUser = isFounder ? chat.investorId : chat.founderId;
              const name = targetUser?.name || targetUser?.username || "User";
              const avatar = targetUser?.avatar || "/default-avatar.png";
              const isVerified =
                targetUser?.isVerified || targetUser?.verificationLevel >= 2;
              const isSelected = activeChat?._id === chat._id;
              const unread = chat.unread || 0;

              const lastTime = chat.lastMessageAt
                ? new Date(chat.lastMessageAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <div
                  key={chat._id}
                  className={`wa-chat-card ${isSelected ? "selected" : ""}`}
                  onClick={() => onSelectChat(chat)}
                >
                  <div className="wa-avatar-wrapper">
                    <img src={avatar} alt={name} className="wa-chat-avatar" />
                    {targetUser?.isOnline && <span className="wa-online-badge"></span>}
                  </div>

                  <div className="wa-chat-info">
                    <div className="wa-chat-row-top">
                      <div className="wa-name-badge-group">
                        <span className="wa-chat-name">{name}</span>
                        {isVerified && (
                          <span className="wa-verified-badge">✓</span>
                        )}
                      </div>
                      <span className="wa-chat-time">{lastTime}</span>
                    </div>

                    <div className="wa-chat-row-bottom">
                      <p className="wa-chat-preview">{chat.lastMessage || "No messages yet"}</p>
                      {unread > 0 && <span className="wa-unread-badge">{unread}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
};

export default ChatSidebar;
