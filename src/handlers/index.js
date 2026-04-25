import { Packet } from "../Packet.js";
import { handleAccountReply } from "./account.js";
import { handleInitReply } from "./init.js";
import { handleLoginReply } from "./login.js";
import { handleMapReply } from "./map.js";

export function registerNetworkHandlers(networkManager) {
    networkManager.on(Packet.PacketFamily.INIT, Packet.PacketAction.INIT_A, handleInitReply);
    networkManager.on(Packet.PacketFamily.ACCOUNT, Packet.PacketAction.REPLY, handleAccountReply);
    networkManager.on(Packet.PacketFamily.LOGIN, Packet.PacketAction.REPLY, handleLoginReply);
    networkManager.on(Packet.PacketFamily.MAP, Packet.PacketAction.REPLY, handleMapReply);
}
