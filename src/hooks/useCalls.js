import { useState, useEffect, useCallback, useRef } from "react";
import callApi from "../services/callApi";
import { getSocket } from "../socket/socket";

export const useCalls = (currentUser) => {
  const [callLogs, setCallLogs] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);

  // Real-time call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  // WebRTC & Screen Sharing state
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteIsScreenSharing, setRemoteIsScreenSharing] = useState(false);
  const [localStreamState, setLocalStreamState] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const screenTrackRef = useRef(null);
  const timerRef = useRef(null);

  // Helper to cleanup media streams & peer connection
  const cleanupCallMedia = useCallback(() => {
    if (screenTrackRef.current) {
      try {
        screenTrackRef.current.stop();
      } catch {}
      screenTrackRef.current = null;
    }
    if (localStream.current) {
      try {
        localStream.current.getTracks().forEach((t) => t.stop());
      } catch {}
      localStream.current = null;
    }
    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch {}
      peerConnection.current = null;
    }
    setLocalStreamState(null);
    setRemoteStream(null);
    setIsScreenSharing(false);
    setRemoteIsScreenSharing(false);
  }, []);

  // Helper to acquire local user media stream
  const startMediaStream = useCallback(async (callType = "video") => {
    try {
      if (localStream.current) return localStream.current;
      const isVideo = callType === "video" || callType === "meeting";
      const constraints = {
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStream.current = stream;
      setLocalStreamState(stream);
      return stream;
    } catch (err) {
      console.warn("Could not access camera/microphone:", err);
      return null;
    }
  }, []);

  // Helper to create & configure WebRTC peer connection
  const createPeerConnection = useCallback((targetId) => {
    if (peerConnection.current) return peerConnection.current;

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && targetId) {
        const socket = getSocket();
        socket?.emit("ice_candidate", {
          targetId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else if (event.track) {
        const newStream = new MediaStream([event.track]);
        setRemoteStream(newStream);
      }
    };

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStream.current);
      });
    }

    peerConnection.current = pc;
    return pc;
  }, []);

  // Load call logs
  const fetchCalls = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const data = await callApi.getCallHistory({
        filter,
        query: searchQuery,
        limit: 50,
      });
      setCallLogs(data.calls || []);
    } catch (err) {
      console.error("Error fetching call logs:", err);
    } finally {
      setLoadingCalls(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Call duration counter
  useEffect(() => {
    if (activeCall && activeCall.status === "accepted") {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall]);

  // Initiate call
  const startCall = useCallback(
    async (receiverId, callType = "voice", recipientName = "", recipientAvatar = "") => {
      try {
        const socket = getSocket();
        console.log("CALL SOCKET STATUS", {
          connected: socket?.connected,
          id: socket?.id,
        });
        console.log("STARTING CALL", {
          receiverId,
          socketConnected: socket?.connected,
        });

        if (socket && socket.connected) {
          socket.emit(
            "call_user",
            { receiverId, callType, type: callType },
            async (ack) => {
              console.log("CALL ACK", ack);
              if (ack && ack.ok) {
                setActiveCall({
                  callId: ack.callId,
                  receiverId,
                  receiverName: recipientName,
                  receiverAvatar: recipientAvatar,
                  callType,
                  status: "ringing",
                  isOutgoing: true,
                });
                await startMediaStream(callType);
              } else {
                // Backend rejected the call — surface the error
                const msg = ack?.error || "Failed to start call. Please try again.";
                console.error("Call initiation rejected:", msg);
                alert(msg);
              }
            },
          );
        } else {
          // Socket not connected — fall back to REST API
          try {
            const res = await callApi.initiateCall(receiverId, callType);
            setActiveCall({
              callId: res.call._id,
              receiverId,
              receiverName: recipientName,
              receiverAvatar: recipientAvatar,
              callType,
              status: "ringing",
              isOutgoing: true,
            });
            await startMediaStream(callType);
          } catch (apiErr) {
            const msg =
              apiErr?.response?.data?.message ||
              apiErr?.message ||
              "Connection not ready. Please check your network and try again.";
            console.error("Call REST fallback failed:", apiErr);
            alert(msg);
          }
        }
      } catch (err) {
        console.error("Failed to initiate call:", err);
        alert(err?.message || "Failed to start call. Please try again.");
      }
    },
    [startMediaStream],
  );


  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("accept_call", { callId: incomingCall.callId });
      } else {
        await callApi.acceptCall(incomingCall.callId);
      }
      setActiveCall({ ...incomingCall, status: "accepted" });
      setIncomingCall(null);

      // Initialize WebRTC media & offer
      const callType = incomingCall.callType || incomingCall.type || "video";
      await startMediaStream(callType);
      const targetId = incomingCall.callerId;
      if (targetId) {
        const pc = createPeerConnection(targetId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit("offer", { targetId, offer });
        socket?.emit("webrtc_offer", { targetId, offer });
      }
    } catch (err) {
      console.error("Error accepting call:", err);
    }
  }, [incomingCall, createPeerConnection, startMediaStream]);

  // Decline / reject call
  const rejectCall = useCallback(async () => {
    if (!incomingCall) return;
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("reject_call", { callId: incomingCall.callId });
      } else {
        await callApi.declineCall(incomingCall.callId);
      }
    } catch (err) {
      console.error("Error declining call:", err);
    } finally {
      setIncomingCall(null);
      cleanupCallMedia();
    }
  }, [incomingCall, cleanupCallMedia]);

  // End active call
  const endCall = useCallback(async () => {
    if (!activeCall) return;
    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit("end_call", { callId: activeCall.callId });
      } else {
        await callApi.endCall(activeCall.callId);
      }
    } catch (err) {
      console.error("Error ending call:", err);
    } finally {
      setActiveCall(null);
      cleanupCallMedia();
      fetchCalls();
    }
  }, [activeCall, cleanupCallMedia, fetchCalls]);

  // Screen Share Functionality
  const toggleScreenShare = useCallback(async () => {
    const targetId = activeCall
      ? activeCall.isOutgoing
        ? activeCall.receiverId
        : activeCall.callerId
      : incomingCall?.callerId;

    if (isScreenSharing) {
      // Revert screen share back to camera track
      if (screenTrackRef.current) {
        try {
          screenTrackRef.current.stop();
        } catch {}
        screenTrackRef.current = null;
      }
      if (peerConnection.current) {
        const videoSender = peerConnection.current
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        const cameraTrack = localStream.current?.getVideoTracks()[0];
        if (videoSender && cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
        }
      }
      setIsScreenSharing(false);
      if (targetId) {
        const socket = getSocket();
        socket?.emit("media_state_change", { targetId, isScreenSharing: false });
      }
    } else {
      // Start display media capture
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        if (peerConnection.current) {
          const videoSender = peerConnection.current
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (videoSender) {
            await videoSender.replaceTrack(screenTrack);
          } else {
            peerConnection.current.addTrack(screenTrack, displayStream);
          }
        }

        // Handle user stopping screen share via browser bar
        screenTrack.onended = async () => {
          if (peerConnection.current) {
            const videoSender = peerConnection.current
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            const cameraTrack = localStream.current?.getVideoTracks()[0];
            if (videoSender && cameraTrack) {
              await videoSender.replaceTrack(cameraTrack);
            }
          }
          setIsScreenSharing(false);
          screenTrackRef.current = null;
          if (targetId) {
            const socket = getSocket();
            socket?.emit("media_state_change", { targetId, isScreenSharing: false });
          }
        };

        setIsScreenSharing(true);
        if (targetId) {
          const socket = getSocket();
          socket?.emit("media_state_change", { targetId, isScreenSharing: true });
        }
      } catch (err) {
        console.error("Screen sharing canceled or failed:", err);
      }
    }
  }, [activeCall, incomingCall, isScreenSharing]);

  // Toggle Mute / Camera
  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    }
  };

  const toggleVideo = async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);

    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !nextVideoOff;
      }

      if (peerConnection.current && !isScreenSharing) {
        const videoSender = peerConnection.current
          .getSenders()
          .find((s) => s.track?.kind === "video" || (s.track === null && s.kind === "video"));
        if (videoSender && track) {
          await videoSender.replaceTrack(!nextVideoOff ? track : null);
        }
      }

      setLocalStreamState(new MediaStream(localStream.current.getTracks()));
    }

    const targetId = activeCall
      ? activeCall.isOutgoing
        ? activeCall.receiverId
        : activeCall.callerId
      : incomingCall?.callerId;

    if (targetId) {
      const socket = getSocket();
      socket?.emit("media_state_change", { targetId, cameraOff: nextVideoOff });
    }
  };

  // Socket event listeners for WebRTC signaling and call state
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncomingCall = (data) => {
      setIncomingCall(data);
    };

    const handleCallAccepted = async (data) => {
      setActiveCall((prev) => (prev ? { ...prev, status: "accepted" } : null));

      // As caller, initiate WebRTC offer when accepted
      const targetId = data?.callerId || activeCall?.receiverId;
      if (targetId) {
        const pc = createPeerConnection(targetId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { targetId, offer });
        socket.emit("webrtc_offer", { targetId, offer });
      }
    };

    const handleCallEnded = () => {
      setActiveCall(null);
      setIncomingCall(null);
      cleanupCallMedia();
      fetchCalls();
    };

    const handleCallTimeout = () => {
      setActiveCall(null);
      setIncomingCall(null);
      cleanupCallMedia();
      fetchCalls();
    };

    const handleOffer = async ({ from, offer }) => {
      try {
        const callType = activeCall?.callType || "video";
        await startMediaStream(callType);
        const pc = createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { targetId: from, answer });
        socket.emit("webrtc_answer", { targetId: from, answer });
      } catch (err) {
        console.error("Error handling WebRTC offer:", err);
      }
    };

    const handleAnswer = async ({ from, answer }) => {
      try {
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
        }
      } catch (err) {
        console.error("Error handling WebRTC answer:", err);
      }
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      try {
        if (peerConnection.current && candidate) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        }
      } catch (err) {
        console.error("Error handling ICE candidate:", err);
      }
    };

    const handleMediaStateChange = ({ from, isScreenSharing }) => {
      if (isScreenSharing !== undefined) {
        setRemoteIsScreenSharing(isScreenSharing);
      }
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_declined", handleCallEnded);
    socket.on("reject_call", handleCallEnded);
    socket.on("call_timeout", handleCallTimeout);
    socket.on("call_no_answer", handleCallTimeout);

    socket.on("offer", handleOffer);
    socket.on("webrtc_offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("webrtc_answer", handleAnswer);
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("media_state_change", handleMediaStateChange);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_ended", handleCallEnded);
      socket.off("call_declined", handleCallEnded);
      socket.off("reject_call", handleCallEnded);
      socket.off("call_timeout", handleCallTimeout);
      socket.off("call_no_answer", handleCallTimeout);

      socket.off("offer", handleOffer);
      socket.off("webrtc_offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("webrtc_answer", handleAnswer);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("media_state_change", handleMediaStateChange);
    };
  }, [activeCall, cleanupCallMedia, createPeerConnection, fetchCalls, startMediaStream]);

  return {
    callLogs,
    loadingCalls,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    selectedCall,
    setSelectedCall,
    incomingCall,
    activeCall,
    isMuted,
    isVideoOff,
    isSpeakerOn,
    isScreenSharing,
    remoteIsScreenSharing,
    localStream: localStreamState,
    remoteStream,
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
    setIsSpeakerOn,
    refreshCalls: fetchCalls,
  };
};

export default useCalls;
