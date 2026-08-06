import { useEffect, useState } from "react";
import { initSocket, getSocket, disconnectSocket } from "../socket/socket";

export const useSocket = (token) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketInstance = initSocket(token);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);

    if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      socketInstance.off("connect", onConnect);
      socketInstance.off("disconnect", onDisconnect);
    };
  }, [token]);

  return { socket: getSocket(), isConnected };
};

export default useSocket;
