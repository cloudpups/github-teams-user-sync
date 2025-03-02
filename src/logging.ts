export type LogEvent = {
    Name: string,
    properties?: {
        [name: string]: string;
    } | undefined
}

export interface ILogger {
    Log(s: string): void
    LogError(ex: string): void
    ReportEvent(event: LogEvent): void
}


export class StdLogger implements ILogger {
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
export function LoggerToUse(): ILogger {
    return logger;
}
export function SetLoggerToUse(l: ILogger) {
    logger = l;
}

export function Log(s: string) {
    logger.Log(s);
}

export function LogError(ex: string) {
    logger.LogError(ex);
}

export class LoggerComposite implements ILogger {
    loggers: ILogger[]

    constructor(loggers: ILogger[]) {
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

