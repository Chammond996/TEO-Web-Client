export class MapCache {
    constructor() {
        this.maps = new Map();
        this.pendingRequests = new Set();
    }

    has(mapId) {
        return this.maps.has(mapId);
    }

    get(mapId) {
        return this.maps.get(mapId) ?? null;
    }

    store(mapData) {
        if (!mapData || !Number.isInteger(mapData.id) || mapData.id <= 0) {
            return;
        }

        this.maps.set(mapData.id, mapData);
        this.pendingRequests.delete(mapData.id);
    }

    storeMany(mapDataList) {
        if (!Array.isArray(mapDataList)) {
            return;
        }

        for (const mapData of mapDataList) {
            this.store(mapData);
        }
    }

    isPending(mapId) {
        return this.pendingRequests.has(mapId);
    }

    markPending(mapId) {
        this.pendingRequests.add(mapId);
    }

    clearPending(mapId) {
        this.pendingRequests.delete(mapId);
    }
}
