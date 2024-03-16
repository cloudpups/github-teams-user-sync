import { describe, test, expect } from "@jest/globals"
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { createClient } from "redis";
import { CacheClient } from "../src/app";
import { QueuePublisher, QueueSubscriber } from "../src/services/pubsub";

describe('Sum function', () => {
    jest.setTimeout(60000);

    let redisContainer: StartedRedisContainer;
    let redisClient: CacheClient;
    let subscriberClient: CacheClient;

    beforeAll(async () => {
        redisContainer = await new RedisContainer().start();
        redisClient = createClient({
            url: redisContainer.getConnectionUrl()
        });
        await redisClient.connect();

        subscriberClient = redisClient.duplicate();
        await subscriberClient.connect();
    })

    afterAll(async () => {
        await redisClient.quit();
        await subscriberClient.quit();
        await redisContainer.stop();
    })

    test('Returns correct value', async () => {
        const subscriber = new QueueSubscriber(subscriberClient);
        const publisher = new QueuePublisher(redisClient);

        const someFn = jest.fn();

        await subscriber.subscribe("CopilotTeamChanged", someFn);

        const expectedEvent = {
            org: "Foo",
            team: "Bar"
        };

        await publisher.publish("CopilotTeamChanged", expectedEvent);
        
        await new Promise((r) => setTimeout(r, 2000));

        expect(someFn).toBeCalledWith(expectedEvent);
    })
})