import React from "react";

export const Tabs = ({ activeTab, onTabChange, unreadChatCount = 0 }) => {
  return (
    <div className="wa-tabs-container">
      <button
        className={`wa-tab-btn ${activeTab === "chats" ? "active" : ""}`}
        onClick={() => onTabChange("chats")}
      >
        <span className="wa-tab-label">Chats</span>
        {unreadChatCount > 0 && <span className="wa-tab-badge">{unreadChatCount}</span>}
      </button>

      <button
        className={`wa-tab-btn ${activeTab === "calls" ? "active" : ""}`}
        onClick={() => onTabChange("calls")}
      >
        <span className="wa-tab-label">Calls</span>
      </button>

      <button
        className={`wa-tab-btn ${activeTab === "media" ? "active" : ""}`}
        onClick={() => onTabChange("media")}
      >
        <span className="wa-tab-label">Media</span>
      </button>
    </div>
  );
};

export default Tabs;
