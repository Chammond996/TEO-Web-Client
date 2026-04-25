import { Packet } from "./Packet.js";

const VERSION_MAJOR = 0;
const VERSION_MINOR = 1;
const VERSION_PATCH = 0;

const ConnectionType = {
    CON_ACCOUNT: 0,
    CON_LOGIN: 1,
};

export class NetworkManager {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.serverUrl = "wss://game.taffi.uk";
        this.messageHandlers = new Map();
        this.pendingResponses = new Map();
        this.responseCallbacks = new Map();
    }

    /**
     * Connect to the server via WebSocket
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve();
                return;
            }

            try {
                this.ws = new WebSocket(this.serverUrl);
                this.ws.binaryType = "arraybuffer";

                this.ws.onopen = () => {
                    this.connected = true;
                    console.log("[Network] Connected to server");
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.onMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    console.error("[Network] WebSocket error:", error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    console.log("[Network] Disconnected from server");
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send a packet to the server
     */
    send(packet) {
        if (!this.connected || !this.ws) {
            console.error("[Network] Not connected to server");
            return false;
        }

        try {
            const bytes = packet.getBytes();
            this.ws.send(bytes);
            return true;
        } catch (error) {
            console.error("[Network] Failed to send packet:", error);
            return false;
        }
    }

    /**
     * Register a handler for packets with a specific family/action
     */
    on(family, action, callback) {
        const key = `${family}:${action}`;
        this.messageHandlers.set(key, callback);
    }

    /**
     * Handle incoming messages
     */
    onMessage(data) {
        try {
            const bytes = new Uint8Array(data);
            if (bytes.length < 2) {
                console.warn("[Network] Received packet too short");
                return;
            }

            const family = bytes[0];
            const action = bytes[1];
            const payload = bytes.slice(2);

            const key = `${family}:${action}`;
            const handler = this.messageHandlers.get(key);

            if (handler) {
                handler(payload);
            } else {
                console.warn(`[Network] No handler for packet ${family}:${action}`);
            }
        } catch (error) {
            console.error("[Network] Failed to process message:", error);
        }
    }

    /**
     * Send INIT packet for connection type
     */
    sendInit(connectionType) {
        const packet = new Packet(Packet.PacketFamily.INIT, Packet.PacketAction.INIT_A);
        packet.addShort(VERSION_MAJOR);
        packet.addShort(VERSION_MINOR);
        packet.addShort(VERSION_PATCH);
        packet.addChar(connectionType);
        this.send(packet);
    }

    /**
     * Request tile/layer data for a single map ID.
     */
    requestMap(mapId) {
        if (!Number.isInteger(mapId) || mapId <= 0) {
            console.warn("[Network] requestMap called with invalid mapId", mapId);
            return false;
        }

        const packet = new Packet(Packet.PacketFamily.MAP, Packet.PacketAction.REQUEST);
        packet.addShort(mapId);
        return this.send(packet);
    }

    /**
     * Connect and initiate new account creation flow
     */
    async initiateAccountCreation() {
        try {
            await this.connect();
            this.sendInit(ConnectionType.CON_ACCOUNT);
            return true;
        } catch (error) {
            console.error("[Network] Failed to initiate account creation:", error);
            return false;
        }
    }

    /**
     * Connect and initiate login flow
     */
    async initiateLogin() {
        try {
            await this.connect();
            this.sendInit(ConnectionType.CON_LOGIN);
            return true;
        } catch (error) {
            console.error("[Network] Failed to initiate login:", error);
            return false;
        }
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.connected = false;
        }
    }

    isConnected() {
        return this.connected;
    }
}

export const networkManager = new NetworkManager();
