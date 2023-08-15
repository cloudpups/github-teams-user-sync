const appInsights = require("applicationinsights");

import { SeverityLevel } from "applicationinsights/out/Declarations/Contracts";
import TelemetryClient from "applicationinsights/out/Library/TelemetryClient";


type LogEvent = {
    Name: string,
    properties?:{
        [name: string]: any;
    } | undefined
}

export interface ILogger {
    Log(s: string): void
    LogError(ex: string): void
    ReportEvent(event: LogEvent): void
}

class AiLogger implements ILogger {
    client: TelemetryClient;

    constructor(client: TelemetryClient) {
        this.client = client;
    }

    ReportEvent(event: LogEvent): void {           
        this.client.trackEvent({
            name: event.Name,            
            properties: event.properties        
        })
    }
    Log(s: string): void {        
        this.client.trackTrace({
            message: s
        });
    }
    LogError(ex: string): void {        
        this.client.trackTrace({
            message: ex,
            severity: SeverityLevel.Error
        });
    }
}

class StdLogger implements ILogger {
    ReportEvent(event: LogEvent): void {
        console.log(`Event ${event.Name}: ${JSON.stringify(event)}`);
    }
    Log(s: string): void {
        console.log(s);
    }
    LogError(ex: string): void {
        console.log(ex);
    }
}

let logger: ILogger;

// HACK: do some better version of DI here...
// maybe don't use a DI Container due to slowness in
// most current libraries. Want this to run fast 
// as a function, eventually.
export function LoggerToUse(): ILogger {
    return logger;
} ; 

export function Log(s: string) {
    logger.Log(s);
}

export function LogError(ex: string) {
    logger.LogError(ex);
}

class LoggerComposite implements ILogger {
    loggers:ILogger[]

    constructor(loggers:ILogger[]) {
        this.loggers = loggers;
    }

    Log(s: string): void {
        this.loggers.forEach(l => l.Log(s));
    }
    LogError(ex: string): void {
        this.loggers.forEach(l => l.LogError(ex));
    }
    ReportEvent(event: LogEvent): void {
        this.loggers.forEach(l => l.ReportEvent(event));
    }

}

export function SetupLogging() {
    const loggers:ILogger[] = [];
    loggers.push(new StdLogger());

    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
        console.log("Using AppInsights Logger")
        appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();

        const telemetryClient = appInsights.defaultClient;

        loggers.push(new AiLogger(telemetryClient));
    }    

    logger = new LoggerComposite(loggers);
}