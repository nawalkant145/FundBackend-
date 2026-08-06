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

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const timerRef = useRef(null);

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
        if (socket && socket.connected) {
          socket.emit(
            "call_user",
            { receiverId, callType, type: callType },
            (ack) => {
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
              }
            },
          );
        } else {
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
        }
      } catch (err) {
        console.error("Failed to initiate call:", err);
      }
    },
    [],
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
    } catch (err) {
      console.error("Error accepting call:", err);
    }
  }, [incomingCall]);

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
    }
  }, [incomingCall]);

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
      if (localStream.current) {
        localStream.current.getTracks().forEach((t) => t.stop());
      }
      fetchCalls();
    }
  }, [activeCall, fetchCalls]);

  // Toggle Mute / Camera
  const toggleMute = () => {
    setIsMuted((prev) => !prev);
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    }
  };

  const toggleVideo = () => {
    setIsVideoOff((prev) => !prev);
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
  };

  // Socket event listeners for calls
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncomingCall = (data) => {
      setIncomingCall(data);
    };

    const handleCallAccepted = () => {
      setActiveCall((prev) => (prev ? { ...prev, status: "accepted" } : null));
    };

    const handleCallEnded = () => {
      setActiveCall(null);
      setIncomingCall(null);
      fetchCalls();
    };

    const handleCallTimeout = () => {
      setActiveCall(null);
      setIncomingCall(null);
      fetchCalls();
    };

    socket.on("incoming_call", handleIncomingCall);
    socket.on("call_accepted", handleCallAccepted);
    socket.on("call_ended", handleCallEnded);
    socket.on("call_declined", handleCallEnded);
    socket.on("reject_call", handleCallEnded);
    socket.on("call_timeout", handleCallTimeout);
    socket.on("call_no_answer", handleCallTimeout);

    return () => {
      socket.off("incoming_call", handleIncomingCall);
      socket.off("call_accepted", handleCallAccepted);
      socket.off("call_ended", handleCallEnded);
      socket.off("call_declined", handleCallEnded);
      socket.off("reject_call", handleCallEnded);
      socket.off("call_timeout", handleCallTimeout);
      socket.off("call_no_answer", handleCallTimeout);
    };
  }, [fetchCalls]);

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
    callDuration,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    setIsSpeakerOn,
    refreshCalls: fetchCalls,
  };
};

export default useCalls;
