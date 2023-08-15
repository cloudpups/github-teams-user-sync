const appInsights = require("applicationinsights");

import { SeverityLevel } from "applicationinsights/out/Declarations/Contracts";
import TelemetryClient from "applicationinsights/out/Library/TelemetryClient";


type LogEvent = {
    Name: string
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
            name: event.Name
        })
    }
    Log(s: string): void {
        console.log(s);
        this.client.trackTrace({
            message: s
        });
    }
    LogError(ex: string): void {
        console.log(ex);
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

let logger: ILogger = new StdLogger();

// HACK: do some better version of DI here...
// maybe don't use a DI Container due to slowness in
// most current libraries. Want this to run fast 
// as a function, eventually.
export const LoggerToUse: ILogger = logger;

export function Log(s: string) {
    logger.Log(s);
}

export function LogError(ex: string) {
    logger.LogError(ex);
}

export function SetupLogging() {
    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
        console.log("Using AppInsights Logger")
        appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();

        const telemetryClient = appInsights.defaultClient;

        logger = new AiLogger(telemetryClient);
    }
}