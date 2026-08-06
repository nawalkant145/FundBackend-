import React from "react";

export const CallCard = ({ call, onSelectCall, onStartCall }) => {
  const otherUser = call.otherUser || call.receiverId || call.callerId;
  const name = otherUser?.name || otherUser?.username || "User";
  const avatar = otherUser?.avatar || "/default-avatar.png";
  const isVerified = otherUser?.isVerified || otherUser?.verificationLevel >= 2;

  const direction = call.direction || "incoming";
  const isMissed =
    call.status === "missed" ||
    call.status === "no_answer" ||
    call.status === "rejected" ||
    call.status === "declined";

  const isVideo = call.callType === "video";

  const formattedDate = new Date(call.createdAt || call.startedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formatDuration = (secs) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="wa-call-card" onClick={() => onSelectCall(call)}>
      <div className="wa-avatar-wrapper">
        <img src={avatar} alt={name} className="wa-call-avatar" />
      </div>

      <div className="wa-call-info">
        <div className="wa-call-name-row">
          <span className={`wa-call-user-name ${isMissed ? "wa-missed-name" : ""}`}>
            {name}
          </span>
          {isVerified && <span className="wa-verified-badge">✓</span>}
        </div>

        <div className="wa-call-sub-row">
          {/* Arrow Indicator */}
          <span className={`wa-direction-icon ${isMissed ? "wa-icon-missed" : "wa-icon-completed"}`}>
            {direction === "outgoing" ? "↗" : "↙"}
          </span>

          <span className="wa-call-type-label">
            {direction === "outgoing" ? "Outgoing" : "Incoming"} {isVideo ? "Video" : "Voice"} Call
          </span>

          <span className="wa-call-dot">•</span>
          <span className="wa-call-date">{formattedDate}</span>

          {call.duration > 0 && (
            <>
              <span className="wa-call-dot">•</span>
              <span className="wa-call-duration">{formatDuration(call.duration)}</span>
            </>
          )}
        </div>
      </div>

      <div className="wa-call-actions">
        <button
          className="wa-call-icon-btn"
          title={`Call ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onStartCall(otherUser?._id, isVideo ? "video" : "voice", name, avatar);
          }}
        >
          {isVideo ? "📹" : "📞"}
        </button>
      </div>
    </div>
  );
};

export default CallCard;
