export class ObjectCache<O, K extends keyof O> {
    private cache: O[];

    private readonly size: number;

    private index: number;

    private readonly keyProp: K;

    public constructor(size: number, keyProp: K) {
        this.cache = [];
        this.size = size;
        this.index = 0;
        this.keyProp = keyProp;
    }

    public has(key: O[K]): boolean {
        return this.cache.some((cacheValue) => cacheValue[this.keyProp] === key);
    }

    public get(key: O[K]): O | null {
        return this.cache.find((cacheValue) => cacheValue[this.keyProp] === key) ?? null;
    }

    public set(value: O): void {
        if (!this.has(value[this.keyProp])) {
            this.cache[this.index] = value;
            this.index = (this.index + 1) % this.size;
        }
    }
}