import { ICacheClient } from '../src/services/CacheClient';

export class InMemoryCacheClient implements ICacheClient{
    private cache: Map<string, any>;
    constructor() {
        this.cache = new Map();
    }

    set(cacheKey: string, object: string, options: { EX: number; }) {
        this.cache.set(cacheKey, object);
        return Promise.resolve(undefined);
    }

    get(key:string) {
        return this.cache.get(key);
    }

}