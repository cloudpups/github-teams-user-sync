import { CacheClient } from "../app";

/**
 * @classdesc As we don't want to be "too leaky" with what we expose, the only data that will currently be included in the CopilotEvent
 * is the OrgId itself. This done, for now, to keep the Copilot Teams sync simple- it will be triggered for the entire Org, or not at all.
 */
export type CopilotEvent = {    
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


export interface IQueueManager extends QueueManager{};
export interface ISubscriber extends Pick<IQueueManager, "Subscribe">{};
export interface IPublisher extends Pick<IQueueManager, "Publish">{};

export class QueueManager implements ISubscriber, IPublisher {
    constructor(private client:CacheClient) {}

    public async Subscribe<T extends QueueIds>(queue:T, listener:(event:EventForQueueMap[T])=>void) {
        function handleParsedEvent(event:string) {
            const asObject = JSON.parse(event) as EventForQueueMap[T];
            listener(asObject);
        }       

        await this.client.subscribe(queue, handleParsedEvent, false);
    }

    public async Publish<T extends QueueIds>(queue:T, event:EventForQueueMap[T]) {
        await this.client.publish(queue, JSON.stringify(event));        
    }
}

export async function BuildPublisher(client:CacheClient):Promise<IPublisher> {
    const singlePublisherClient = client.duplicate();
    await singlePublisherClient.connect();
    return new QueueManager(singlePublisherClient);
}