export interface ICacheClient {
    set(cacheKey: string, object: string, options: { EX: number; }): Promise<undefined>;
    get(cacheKey: string): Promise<string | null>;
}