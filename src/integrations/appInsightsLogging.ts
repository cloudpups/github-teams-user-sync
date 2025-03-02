const appInsights = require("applicationinsights");
import {KnownSeverityLevel, TelemetryClient} from "applicationinsights";
import { ILogger, LogEvent, LoggerComposite, StdLogger } from "../logging";

export function SetupLogging() {
    const loggers: ILogger[] = [];
    loggers.push(new StdLogger());

    if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
        console.log("Using AppInsights Logger")
        appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();

        const telemetryClient = appInsights.defaultClient;

        loggers.push(new AiLogger(telemetryClient));
    }

    return new LoggerComposite(loggers);
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
            severity: KnownSeverityLevel.Error
        });
    }
}