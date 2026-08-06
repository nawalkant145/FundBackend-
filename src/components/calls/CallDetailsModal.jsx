import React from "react";

export const CallDetailsModal = ({
  call,
  onClose,
  onStartVoiceCall,
  onStartVideoCall,
  onMessageUser,
}) => {
  if (!call) return null;

  const otherUser = call.otherUser || call.receiverId || call.callerId;
  const name = otherUser?.name || otherUser?.username || "User";
  const avatar = otherUser?.avatar || "/default-avatar.png";
  const isVerified = otherUser?.isVerified || otherUser?.verificationLevel >= 2;

  const isMissed =
    call.status === "missed" ||
    call.status === "no_answer" ||
    call.status === "rejected" ||
    call.status === "declined";

  const isVideo = call.callType === "video";

  const startTime = new Date(call.startedAt || call.createdAt).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = call.endedAt
    ? new Date(call.endedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A";

  const formatDuration = (secs) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="wa-modal-backdrop" onClick={onClose}>
      <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="wa-modal-close-btn" onClick={onClose}>
          ✕
        </button>

        <div className="wa-modal-user-header">
          <img src={avatar} alt={name} className="wa-modal-avatar" />
          <div className="wa-modal-user-name-row">
            <h3 className="wa-modal-user-name">{name}</h3>
            {isVerified && <span className="wa-verified-badge">✓</span>}
          </div>
          <p className="wa-modal-user-company">{otherUser?.companyName || "Member"}</p>
        </div>

        <div className="wa-modal-details-body">
          <div className="wa-detail-item">
            <span className="wa-detail-label">Call Type</span>
            <span className="wa-detail-value">
              {call.direction === "outgoing" ? "Outgoing" : "Incoming"} {isVideo ? "Video" : "Voice"}
            </span>
          </div>

          <div className="wa-detail-item">
            <span className="wa-detail-label">Call Status</span>
            <span className={`wa-detail-value ${isMissed ? "wa-text-danger" : "wa-text-success"}`}>
              {call.status}
            </span>
          </div>

          <div className="wa-detail-item">
            <span className="wa-detail-label">Duration</span>
            <span className="wa-detail-value">{formatDuration(call.duration)}</span>
          </div>

          <div className="wa-detail-item">
            <span className="wa-detail-label">Start Time</span>
            <span className="wa-detail-value">{startTime}</span>
          </div>

          <div className="wa-detail-item">
            <span className="wa-detail-label">End Time</span>
            <span className="wa-detail-value">{endTime}</span>
          </div>

          <div className="wa-detail-item">
            <span className="wa-detail-label">Network Quality</span>
            <span className="wa-detail-value wa-text-success">Good (HD)</span>
          </div>
        </div>

        <div className="wa-modal-actions-footer">
          <button
            className="wa-btn wa-btn-primary"
            onClick={() => onStartVoiceCall(otherUser?._id, name, avatar)}
          >
            📞 Call Again
          </button>
          <button
            className="wa-btn wa-btn-secondary"
            onClick={() => onStartVideoCall(otherUser?._id, name, avatar)}
          >
            📹 Video Call
          </button>
          <button
            className="wa-btn wa-btn-outline"
            onClick={() => onMessageUser(call.chatId)}
          >
            💬 Message User
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallDetailsModal;
