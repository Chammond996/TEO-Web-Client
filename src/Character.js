/**
 * Character class for TEO Web Client.
 * Mirrors the C++ Character class from CreedServer.
 * Also contains animation and rendering state.
 */
export class Character {
    constructor(name = "") {
        // Network/Character data
        this.id = 0;
        this.name = name;
        this.accountName = "";
        this.level = 0;
        this.gender = 0; // FEMALE
        this.skin = 0; // WHITE
        this.direction = 0; // DOWN
        this.hairStyle = 1;
        this.hairColour = 0;
        this.mapId = 0;
        this.mapX = 0;
        this.mapY = 0;
        this.loggedIn = false;

        // Animation/Rendering state
        this.state = "idle"; // idle, walk, attack, hurt, dead
        this.frame = 0; // Current animation frame
        this.position = { x: 0, y: 0 }; // Screen position
        this.sprite = null; // Canvas element for rendering
        this.isMoving = false;
        this.showDebugInfo = false;
    }

    // Getters
    getId() {
        return this.id;
    }

    getName() {
        return this.name;
    }

    getAccountName() {
        return this.accountName;
    }

    getLevel() {
        return this.level;
    }

    getGender() {
        return this.gender;
    }

    getSkin() {
        return this.skin;
    }

    getDirection() {
        return this.direction;
    }

    getHairStyle() {
        return this.hairStyle;
    }

    getHairColour() {
        return this.hairColour;
    }

    getMapId() {
        return this.mapId;
    }

    getMapX() {
        return this.mapX;
    }

    getMapY() {
        return this.mapY;
    }

    isLoggedIn() {
        return this.loggedIn;
    }

    // Setters
    setId(id) {
        this.id = id;
    }

    setName(name) {
        this.name = name;
    }

    setAccountName(accountName) {
        this.accountName = accountName;
    }

    setLevel(level) {
        this.level = level;
    }

    setGender(gender) {
        this.gender = gender;
    }

    setSkin(skin) {
        this.skin = skin;
    }

    setDirection(direction) {
        this.direction = direction;
    }

    setHairStyle(hairStyle) {
        this.hairStyle = hairStyle;
    }

    setHairColour(hairColour) {
        this.hairColour = hairColour;
    }

    setMapId(mapId) {
        this.mapId = mapId;
    }

    setMapX(mapX) {
        this.mapX = mapX;
    }

    setMapY(mapY) {
        this.mapY = mapY;
    }

    setLoggedIn(status) {
        this.loggedIn = status;
    }

    // Animation and rendering state methods
    getState() {
        return this.state;
    }

    setState(state) {
        this.state = state;
    }

    getFrame() {
        return this.frame;
    }

    setFrame(frame) {
        this.frame = frame;
    }

    getPosition() {
        return this.position;
    }

    setPosition(x, y) {
        this.position = { x, y };
    }

    getSprite() {
        return this.sprite;
    }

    setSprite(sprite) {
        this.sprite = sprite;
    }

    setMoving(isMoving) {
        this.isMoving = isMoving;
        if (isMoving) {
            this.state = "walk";
        } else {
            this.state = "idle";
        }
    }

    /**
     * Parses character data from a packet response.
    * Expects: id (int), name (string), skin (char), gender (char), hairStyle (char), hairColour (char), mapId (short), mapX (short), mapY (short)
     * @param {Packet} packet - The packet containing character data
     */
    parseFromPacket(packet) {
        if (packet.data && packet.data.length >= 4) {
            this.id = packet.readInt();
            this.name = packet.readString();
            this.skin = packet.readChar();
            this.gender = packet.readChar();
            this.hairStyle = packet.readChar();
            this.hairColour = packet.readChar();
            this.mapId = packet.readShort();
            this.mapX = packet.readShort();
            this.mapY = packet.readShort();
        }
    }
}
