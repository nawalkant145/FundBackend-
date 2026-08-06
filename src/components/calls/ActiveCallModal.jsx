import React from "react";

export const ActiveCallModal = ({
  incomingCall,
  activeCall,
  callDuration,
  isMuted,
  isVideoOff,
  isSpeakerOn,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
}) => {
  const currentCall = incomingCall || activeCall;
  if (!currentCall) return null;

  const isIncoming = !!incomingCall;
  const isVideo = currentCall.callType === "video" || currentCall.type === "video";
  const name = currentCall.callerName || currentCall.receiverName || "User";
  const avatar = currentCall.callerAvatar || currentCall.receiverAvatar || "/default-avatar.png";

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="wa-call-modal-overlay">
      <div className="wa-call-modal-card">
        {/* User Info Header */}
        <div className="wa-call-user-avatar-container">
          <img src={avatar} alt={name} className="wa-call-modal-avatar" />
          <div className="wa-call-pulse-ring"></div>
        </div>

        <h3 className="wa-call-modal-name">{name}</h3>

        <span className="wa-call-modal-status-text">
          {isIncoming
            ? `Incoming ${isVideo ? "Video" : "Voice"} Call...`
            : activeCall?.status === "ringing"
            ? "Ringing..."
            : formatTimer(callDuration)}
        </span>

        {/* Video stream container placeholder */}
        {isVideo && !isIncoming && activeCall?.status === "accepted" && (
          <div className="wa-video-stream-container">
            <div className="wa-remote-video">
              <span>Remote Video Stream</span>
            </div>
            <div className="wa-local-video-pip">
              <span>Local</span>
            </div>
          </div>
        )}

        {/* Incoming Call Action Controls */}
        {isIncoming ? (
          <div className="wa-call-actions-row">
            <button className="wa-call-btn wa-btn-decline" onClick={onReject} title="Decline">
              📞 Decline
            </button>
            <button className="wa-call-btn wa-btn-accept" onClick={onAccept} title="Accept">
              📞 Accept
            </button>
          </div>
        ) : (
          /* Active Call Controls */
          <div className="wa-call-actions-row">
            <button
              className={`wa-call-control-btn ${isMuted ? "active-off" : ""}`}
              onClick={onToggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🎙️ Off" : "🎙️ Mute"}
            </button>

            {isVideo && (
              <button
                className={`wa-call-control-btn ${isVideoOff ? "active-off" : ""}`}
                onClick={onToggleVideo}
                title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isVideoOff ? "📹 Off" : "📹 Camera"}
              </button>
            )}

            <button
              className={`wa-call-control-btn ${!isSpeakerOn ? "active-off" : ""}`}
              onClick={onToggleSpeaker}
              title={isSpeakerOn ? "Speaker On" : "Speaker Off"}
            >
              {isSpeakerOn ? "🔊 Speaker" : "🔈 Muted"}
            </button>

            <button className="wa-call-btn wa-btn-end" onClick={onEnd} title="End Call">
              📞 End
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveCallModal;
