import { context, trace } from '@opentelemetry/api';
import { safeSerialize } from './redaction';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEvent {
    event: string;
    [key: string]: unknown;
}

export type LogSink = (line: string) => void;

export interface StructuredLoggerOptions {
    mode: 'development' | 'test' | 'production';
    service?: string;
    sink?: LogSink;
}

const traceFields = (): Record<string, string> => {
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    return spanContext?.traceId
        ? { traceId: spanContext.traceId, spanId: spanContext.spanId }
        : {};
};

export class StructuredLogger {
    private readonly sink: LogSink;
    private readonly service: string;
    private readonly mode: StructuredLoggerOptions['mode'];

    public constructor(options: StructuredLoggerOptions) {
        this.mode = options.mode;
        this.service = options.service ?? 'jubilant-adventure-api';
        this.sink =
            options.sink ?? ((line) => process.stdout.write(`${line}\n`));
    }

    public write(level: LogLevel, event: LogEvent): void {
        const payload = {
            timestamp: new Date().toISOString(),
            level,
            service: this.service,
            ...event,
            ...traceFields(),
        };
        if (this.mode === 'development') {
            this.sink(
                `[${level}] ${event.event} ${safeSerialize({ ...payload, timestamp: undefined })}`,
            );
            return;
        }
        this.sink(safeSerialize(payload));
    }

    public info(event: LogEvent): void {
        this.write('info', event);
    }

    public warn(event: LogEvent): void {
        this.write('warn', event);
    }

    public error(event: LogEvent): void {
        this.write('error', event);
    }
}

export const createLogger = (
    mode: StructuredLoggerOptions['mode'] = process.env.APP_MODE ===
    'production'
        ? 'production'
        : process.env.APP_MODE === 'test'
          ? 'test'
          : 'development',
): StructuredLogger => new StructuredLogger({ mode });
