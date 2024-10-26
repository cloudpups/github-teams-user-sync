import { ICacheClient } from "../src/services/CacheClient";

export class InMemoryCache implements ICacheClient {
    private cache:Map<string,string> = new Map<string,string>();

    set(cacheKey: string, object: string, options: { EX: number; }): Promise<undefined> {
        this.cache.set(cacheKey, object);

        return Promise.resolve(undefined);
    }

    get(cacheKey: string): Promise<string | undefined> {
        const value = this.cache.get(cacheKey);

        return Promise.resolve(value);
    }
}