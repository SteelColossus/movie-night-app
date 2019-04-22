class ObjectCache {
    constructor(size, keyProp) {
        this.cache = [];
        this.size = size;
        this.index = 0;
        this.keyProp = keyProp;
    }

    has(key) {
        return this.cache.some(cacheValue => cacheValue[this.keyProp] === key);
    }

    get(key) {
        return this.cache.find(cacheValue => cacheValue[this.keyProp] === key);
    }

    set(value) {
        if (value != null && typeof value === 'object' && value.hasOwnProperty(this.keyProp)) {
            if (!this.has(value[this.keyProp])) {
                this.cache[this.index] = value;
                this.index = (this.index + 1) % this.size;
            }
        }
        else {
            throw new Error(`Invalid value to set - must be a non-null object with property '${this.keyProp}'.`);
        }
    }
}

module.exports = ObjectCache;