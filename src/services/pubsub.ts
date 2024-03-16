import { CacheClient } from "../app";

export type CopilotEvent = {
    team:string,
    org:string
}

export type TeamSettingsChangedEvent = {
    team:string,
    org:string
}

export type EventForQueueMap = {
  'CopilotTeamChanged': CopilotEvent;
  'TeamSettingsChanged': TeamSettingsChangedEvent;  
}

export type QueueIds = keyof EventForQueueMap;

export class QueuePublisher {
    constructor(private client:CacheClient) {}

    public async publish<T extends QueueIds>(queue:T, event:EventForQueueMap[T]) {
        await this.client.publish(queue, JSON.stringify(event));
    }
}

export class QueueSubscriber {
    constructor(private client:CacheClient) {}

    public async subscribe<T extends QueueIds>(queue:T, listener:(event:EventForQueueMap[T])=>void) {
        function handleParsedEvent(event:string) {
            const asObject = JSON.parse(event) as EventForQueueMap[T];
            listener(asObject);
        }       

        await this.client.subscribe(queue, handleParsedEvent, false);
    }
}

