import { Packet } from "../Packet.js";

export function handleMapReply(payload) {
    let offset = 0;

    const [mode, afterMode] = Packet.getChar(payload, offset);
    offset = afterMode;

    const [success, afterSuccess] = Packet.getChar(payload, offset);
    offset = afterSuccess;

    const [count, afterCount] = Packet.getShort(payload, offset);
    offset = afterCount;

    const maps = [];

    for (let i = 0; i < count; i++) {
        const [id, afterId] = Packet.getShort(payload, offset);
        offset = afterId;

        const [width, afterWidth] = Packet.getShort(payload, offset);
        offset = afterWidth;

        const [height, afterHeight] = Packet.getShort(payload, offset);
        offset = afterHeight;

        const [fillTile, afterFillTile] = Packet.getShort(payload, offset);
        offset = afterFillTile;

        const tileCount = width * height;
        const tileSpecs = new Array(tileCount);
        const layers = Array.from({ length: 9 }, () => new Array(tileCount));

        for (let t = 0; t < tileCount; t++) {
            const [encodedSpec, afterSpec] = Packet.getShort(payload, offset);
            offset = afterSpec;
            tileSpecs[t] = encodedSpec - 1;
        }

        for (let layer = 0; layer < 9; layer++) {
            for (let t = 0; t < tileCount; t++) {
                const [tileLayer, afterTileLayer] = Packet.getShort(payload, offset);
                offset = afterTileLayer;
                layers[layer][t] = tileLayer;
            }
        }

        maps.push({
            id,
            width,
            height,
            fillTile,
            tileSpecs,
            layers,
            mode,
        });
    }

    document.dispatchEvent(new CustomEvent("network:map-reply", {
        detail: {
            success: success === 1,
            mode,
            maps,
        },
    }));
}
