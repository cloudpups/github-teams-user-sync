import appInsights from "applicationinsights";
import TelemetryClient from "applicationinsights/out/Library/TelemetryClient";

export interface ILogger {
    Log(s:any):void
    LogError(s:any):void
}

class AiLogger implements ILogger {
    client: TelemetryClient;
    
    constructor(client: TelemetryClient) {
        this.client = client;
    }
    Log(s: any): void {
        throw new Error("Method not implemented.");
    }
    LogError(s: any): void {
        throw new Error("Method not implemented.");
    }
}

class StdLogger implements ILogger {
    Log(s: any): void {
        console.log(s);
    }
    LogError(s: any): void {
        console.log(s);
    }
}

let logger: ILogger = new StdLogger();

if(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    appInsights.setup().start();

    const telemetryClient = appInsights.defaultClient;

    logger = new AiLogger(telemetryClient);
}

export function Log(s:any) {
    logger.Log(s);
} 

export function LogError(s:any) {
    logger.LogError(s);
} 