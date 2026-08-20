import React from "react";

export const ChatHeader = ({
  chat,
  currentUser,
  targetUser,
  onStartVoiceCall,
  onStartVideoCall,
  onToggleSearch,
  onCreateDealRoom,
  isTyping = false,
}) => {
  if (!chat) return null;

  const name = targetUser?.name || targetUser?.username || "User";
  const avatar = targetUser?.avatar || "/default-avatar.png";
  const isOnline = targetUser?.isOnline;
  const lastSeen = targetUser?.lastSeen;

  // Badges
  const isIdentityVerified = targetUser?.isIdentityVerified || targetUser?.isVerified || targetUser?.verificationLevel >= 2;
  const isBusinessVerified = targetUser?.isBusinessVerified || (targetUser?.role === "founder" && targetUser?.companyVerificationStatus === "approved");
  const isOrganizationVerified = targetUser?.isOrganizationVerified || (targetUser?.role === "investor" && targetUser?.investmentVerificationStatus === "approved");
  const isInvestorProfileReviewed = targetUser?.isInvestorProfileVerified || (targetUser?.role === "investor" && targetUser?.investmentVerificationStatus === "approved");
  const isStartupComplete = targetUser?.role === "founder" && targetUser?.profileCompleteness >= 70;

  const renderStatus = () => {
    if (isTyping) return <span className="wa-typing-text">typing...</span>;
    if (isOnline) return <span className="wa-online-text">online</span>;
    if (lastSeen) {
      const date = new Date(lastSeen);
      return `last seen ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return "offline";
  };

  return (
    <header className="wa-chat-header">
      <div className="wa-chat-header-info">
        <div className="wa-avatar-wrapper">
          <img src={avatar} alt={name} className="wa-avatar-img" />
          {isOnline && <span className="wa-online-badge"></span>}
        </div>
        <div className="wa-user-details">
          <div className="wa-user-name-row" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span className="wa-user-name" style={{ fontWeight: 600 }}>{name}</span>
            {/* Multi-badge pills */}
            {isIdentityVerified && (
              <span className="badge-pill identity-badge" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981", fontSize: "11px", padding: "2px 6px", borderRadius: "10px", fontWeight: 600 }} title="🟢 Identity Verified (Aadhaar/DigiLocker + PAN)">
                🟢 Identity Verified
              </span>
            )}
            {targetUser?.role === "founder" && isBusinessVerified && (
              <span className="badge-pill business-badge" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", fontSize: "11px", padding: "2px 6px", borderRadius: "10px", fontWeight: 600 }} title="🔵 Business Verified (Incorporation/CIN/PAN)">
                🔵 Business Verified
              </span>
            )}
            {targetUser?.role === "investor" && isOrganizationVerified && (
              <span className="badge-pill org-badge" style={{ backgroundColor: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", fontSize: "11px", padding: "2px 6px", borderRadius: "10px", fontWeight: 600 }} title="🔵 Organization Verified">
                🔵 Organization Verified
              </span>
            )}
            {targetUser?.role === "investor" && isInvestorProfileReviewed && (
              <span className="badge-pill investor-badge" style={{ backgroundColor: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6", fontSize: "11px", padding: "2px 6px", borderRadius: "10px", fontWeight: 600 }} title="🟣 Investor Profile Reviewed">
                🟣 Investor Profile Reviewed
              </span>
            )}
            {targetUser?.role === "founder" && isStartupComplete && (
              <span className="badge-pill startup-badge" style={{ backgroundColor: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: "11px", padding: "2px 6px", borderRadius: "10px", fontWeight: 600 }} title="🟡 Startup Profile Complete">
                🟡 Startup Profile Complete
              </span>
            )}
          </div>
          <span className="wa-user-status">{renderStatus()}</span>
        </div>
      </div>

      <div className="wa-chat-header-actions" style={{ display: "flex", gap: "8px" }}>
        {onCreateDealRoom && (() => {
          const userRole = currentUser?.role || "founder";
          const targetRole = targetUser?.role || "founder";
          const buttonLabel = (userRole === "founder" && targetRole === "investor")
            ? "🔐 Request Deal Room"
            : "🔐 Create Deal Room";

          return (
            <button
              className="wa-header-action-btn deal-room-btn"
              title={buttonLabel}
              onClick={() => onCreateDealRoom(chat)}
              style={{
                backgroundColor: "#8b5cf6",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              {buttonLabel}
            </button>
          );
        })()}

        <button
          className="wa-header-action-btn"
          title="Voice Call"
          onClick={() => onStartVoiceCall(targetUser?._id, name, avatar)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>

        <button
          className="wa-header-action-btn"
          title="Video Call"
          onClick={() => onStartVideoCall(targetUser?._id, name, avatar)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
          </svg>
        </button>

        <button
          className="wa-header-action-btn"
          title="Search in Chat"
          onClick={onToggleSearch}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default ChatHeader;
