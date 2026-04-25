/**
 * Packet class for Creed protocol communication.
 * Mirrors C++ Packets class with big-endian byte serialization.
 */
export class Packet {
    static PacketFamily = {
        NULL_F: -1,
        INIT: 0,
        ACCOUNT: 1,
        LOGIN: 2,
        CHARACTER: 3,
        MAP: 4,
    };

    static PacketAction = {
        NULL_A: -1,
        INIT_A: 0,
        CREATE: 1,
        REQUEST: 2,
        REPLY: 3,
    };

    constructor(family, action) {
        this.family = family;
        this.action = action;
        this.data = [];
    }

    addChar(value) {
        this.data.push(value & 0xFF);
    }

    addShort(value) {
        this.data.push((value >> 8) & 0xFF);
        this.data.push(value & 0xFF);
    }

    addInt(value) {
        this.data.push((value >> 24) & 0xFF);
        this.data.push((value >> 16) & 0xFF);
        this.data.push((value >> 8) & 0xFF);
        this.data.push(value & 0xFF);
    }

    addLong(value) {
        for (let i = 7; i >= 0; i--) {
            this.data.push((value >> (i * 8)) & 0xFF);
        }
    }

    addString(str) {
        const encoded = new TextEncoder().encode(str);
        this.addInt(encoded.length);
        for (let i = 0; i < encoded.length; i++) {
            this.data.push(encoded[i]);
        }
    }

    getBytes() {
        const result = new Uint8Array([this.family, this.action, ...this.data]);
        return result;
    }

    static fromBytes(bytes) {
        const packet = new Packet(bytes[0], bytes[1]);
        packet.data = Array.from(bytes.slice(2));
        return packet;
    }

    static getChar(bytes, offset) {
        return [bytes[offset], offset + 1];
    }

    static getShort(bytes, offset) {
        const value = (bytes[offset] << 8) | bytes[offset + 1];
        return [value, offset + 2];
    }

    static getInt(bytes, offset) {
        const value =
            (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            bytes[offset + 3];
        return [value >>> 0, offset + 4];
    }

    static getLong(bytes, offset) {
        let value = 0;
        for (let i = 0; i < 8; i++) {
            value = (value << 8) | bytes[offset + i];
        }
        return [value, offset + 8];
    }

    static getString(bytes, offset) {
        const [len, nextOffset] = Packet.getInt(bytes, offset);
        const strBytes = bytes.slice(nextOffset, nextOffset + len);
        const str = new TextDecoder().decode(strBytes);
        return [str, nextOffset + len];
    }
}
