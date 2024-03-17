import { describe, test, expect } from "@jest/globals"
import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { createClient } from "redis";
import { CacheClient } from "../src/app";
import { CopilotEvent, IPublisher, ISubscriber, QueueManager } from "../src/services/queueManager";

/**
 * This "test suite" is technically exercising both the Subscriber and Publisher logic...
 * For what this accomplishes though, it is fine for now. Ideally each suite will only test one component.
 */
describe('QueueManager', () => {
    jest.setTimeout(60000);

    let redisContainer: StartedRedisContainer;
    let redisClient: CacheClient;
    let subscriberClient: CacheClient;

    const expectedEvents = [1,2,3].map(n => {
        return {
            org: `Foo${n}`,
            team: `Bar${1}`
        } as CopilotEvent
    });

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

    test('executes given function with expected event.', async () => {
        // Arrange
        const subscriber = new QueueManager(subscriberClient) as ISubscriber;
        const publisher = new QueueManager(redisClient) as IPublisher;
        const someFn = jest.fn();

        await subscriber.Subscribe("CopilotTeamChanged", someFn);        

        // Act
        await publisher.Publish("CopilotTeamChanged", expectedEvents[0]);

        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        expect(someFn).toHaveBeenNthCalledWith(1, expectedEvents[0]);
        expect(someFn).toBeCalledTimes(1);
    })

    test('executes same amount of times as published events.', async () => {
        // Arrange
        const subscriber = new QueueManager(subscriberClient) as ISubscriber;
        const publisher = new QueueManager(redisClient)  as IPublisher;
        const someFn = jest.fn();

        await subscriber.Subscribe("CopilotTeamChanged", someFn);        

        // Act
        await publisher.Publish("CopilotTeamChanged", expectedEvents[0]);
        await publisher.Publish("CopilotTeamChanged", expectedEvents[1]);
        await publisher.Publish("CopilotTeamChanged", expectedEvents[2]);

        await new Promise((r) => setTimeout(r, 2000));

        // Assert        
        expect(someFn).toBeCalledTimes(3);
    })
})