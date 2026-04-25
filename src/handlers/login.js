import { Packet } from "../Packet.js";
import { Character } from "../Character.js";

export function handleLoginReply(payload) {
    let offset = 0;
    const [successFlag, nextOffset] = Packet.getChar(payload, offset);
    offset = nextOffset;

    const success = successFlag === 1;
    const characters = [];

    if (success && payload.length > offset) {
        const [count, afterCount] = Packet.getChar(payload, offset);
        offset = afterCount;

        for (let i = 0; i < count; i++) {
            const character = new Character();
            
            // Parse character data: id, name, skin, gender, hairStyle, hairColour, mapId, mapX, mapY
            const [id, afterId] = Packet.getInt(payload, offset);
            offset = afterId;
            character.setId(id);
            
            const [name, afterName] = Packet.getString(payload, offset);
            offset = afterName;
            character.setName(name);
            
            const [skin, afterSkin] = Packet.getChar(payload, offset);
            offset = afterSkin;
            character.setSkin(skin);
            
            const [gender, afterGender] = Packet.getChar(payload, offset);
            offset = afterGender;
            character.setGender(gender);
            
            const [hairStyle, afterHairStyle] = Packet.getChar(payload, offset);
            offset = afterHairStyle;
            character.setHairStyle(hairStyle);
            
            const [hairColour, afterHairColour] = Packet.getChar(payload, offset);
            offset = afterHairColour;
            character.setHairColour(hairColour);

            const [mapId, afterMapId] = Packet.getShort(payload, offset);
            offset = afterMapId;
            character.setMapId(mapId);

            const [mapX, afterMapX] = Packet.getShort(payload, offset);
            offset = afterMapX;
            character.setMapX(mapX);

            const [mapY, afterMapY] = Packet.getShort(payload, offset);
            offset = afterMapY;
            character.setMapY(mapY);
            
            characters.push(character);
        }
    }

    document.dispatchEvent(new CustomEvent("network:login-reply", {
        detail: { success, characters },
    }));
}
