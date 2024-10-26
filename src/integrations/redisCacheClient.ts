import { CacheClient } from "../app";
import { ICacheClient } from "../services/CacheClient";

export class RedisCacheClient implements ICacheClient {
    constructor(private cacheClient: CacheClient){};

    async set(cacheKey: string, object: string, options: { EX: number; }): Promise<undefined> {
        await this.cacheClient.set(cacheKey, object, {
            EX: options.EX            
        }); 
    }

    async get(cacheKey: string): Promise<string | null> {
        return await this.cacheClient.get(cacheKey);
    }

}