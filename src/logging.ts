const appInsights = require("applicationinsights");

import { SeverityLevel } from "applicationinsights/out/Declarations/Contracts";
import TelemetryClient from "applicationinsights/out/Library/TelemetryClient";

interface ILogger {
    Log(s:string):void
    LogError(ex: string):void
}

class AiLogger implements ILogger {
    client: TelemetryClient;
    
    constructor(client: TelemetryClient) {
        this.client = client;
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
    Log(s: string): void {
        console.log(s);
    }
    LogError(ex: string): void {
        console.log(ex);
    }
}

let logger: ILogger = new StdLogger();

export function Log(s:string) {
    logger.Log(s);
} 

export function LogError(ex: string) {
    logger.LogError(ex);
} 

export function SetupLogging() {
    if(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
        console.log("Using AppInsights Logger")
        appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING).start();        

        const telemetryClient = appInsights.defaultClient;
    
        logger = new AiLogger(telemetryClient);
    }
}