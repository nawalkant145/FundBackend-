import React, { useEffect, useRef } from "react";

export const ActiveCallModal = ({
  incomingCall,
  activeCall,
  callDuration,
  isMuted,
  isVideoOff,
  isSpeakerOn,
  isScreenSharing,
  remoteIsScreenSharing,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  onToggleSpeaker,
  onToggleScreenShare,
}) => {
  const currentCall = incomingCall || activeCall;
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const isIncoming = !!incomingCall;
  const isVideo = currentCall?.callType === "video" || currentCall?.type === "video" || currentCall?.callType === "meeting";
  const name = currentCall?.callerName || currentCall?.receiverName || "User";
  const avatar = currentCall?.callerAvatar || currentCall?.receiverAvatar || "/default-avatar.png";

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("🎥 ActiveCallModal localVideoRef setting srcObject:", localStream.id);
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play?.().catch((err) => console.warn("⚠️ Local video play error:", err));
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("📹 ActiveCallModal remoteVideoRef setting srcObject:", remoteStream.id);
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play?.().catch((err) => console.warn("⚠️ Remote video play error:", err));
    }
  }, [remoteStream, activeCall?.status]);

  if (!currentCall) return null;

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="wa-call-modal-overlay">
      <div className="wa-call-modal-card">
        {/* Remote Screen Sharing Badge */}
        {remoteIsScreenSharing && (
          <div className="wa-screenshare-badge">
            🖥️ {name} is sharing screen
          </div>
        )}

        {/* User Info Header */}
        {(!remoteStream || !isVideo) && (
          <div className="wa-call-user-avatar-container">
            <img src={avatar} alt={name} className="wa-call-modal-avatar" />
            <div className="wa-call-pulse-ring"></div>
          </div>
        )}

        <h3 className="wa-call-modal-name">{name}</h3>

        <span className="wa-call-modal-status-text">
          {isIncoming
            ? `Incoming ${isVideo ? "Video" : "Voice"} Call...`
            : activeCall?.status === "ringing"
            ? "Ringing..."
            : formatTimer(callDuration)}
        </span>

        {/* Live Video Streams (Camera / Screen Share) */}
        {isVideo && !isIncoming && activeCall?.status === "accepted" && (
          <div className="wa-video-stream-container">
            <div className="wa-remote-video">
              {remoteStream ? (
                <video
                  ref={(el) => {
                    remoteVideoRef.current = el;
                    if (el && remoteStream && el.srcObject !== remoteStream) {
                      console.log("📹 Callback ref setting remoteVideoRef.srcObject:", remoteStream.id);
                      el.srcObject = remoteStream;
                      el.play?.().catch((err) => console.warn("⚠️ Remote video play error:", err));
                    }
                  }}
                  autoPlay
                  playsInline
                  className="wa-video-element"
                />
              ) : (
                <div className="wa-video-placeholder">
                  <span>Connecting remote video stream...</span>
                </div>
              )}
            </div>

            {localStream && (
              <div className="wa-local-video-pip">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="wa-video-element-pip"
                />
              </div>
            )}
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
              <>
                <button
                  className={`wa-call-control-btn ${isVideoOff ? "active-off" : ""}`}
                  onClick={onToggleVideo}
                  title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
                >
                  {isVideoOff ? "📹 Off" : "📹 Camera"}
                </button>

                <button
                  className={`wa-call-control-btn ${isScreenSharing ? "active-sharing" : ""}`}
                  onClick={onToggleScreenShare}
                  title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
                >
                  {isScreenSharing ? "🖥️ Stop Share" : "🖥️ Share Screen"}
                </button>
              </>
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
