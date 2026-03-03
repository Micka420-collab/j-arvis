/**
 * Logger pour le système d'autonomie
 * Remplace console.log par un système de logging structuré
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  prefix?: string;
}

export class AutonomyLogger {
  private config: LoggerConfig;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: "info",
      enableConsole: true,
      enableFile: false,
      prefix: "[Autonomy]",
      ...config,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.config.level);
  }

  private log(level: LogLevel, module: string, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      module,
      message,
      data,
    };

    this.logs.push(entry);

    // Limiter la taille
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      const prefix = `${this.config.prefix} [${level.toUpperCase()}] [${module}]`;
      const timestamp = entry.timestamp.toISOString();
      
      switch (level) {
        case "debug":
          console.debug(`${timestamp} ${prefix} ${message}`, data || "");
          break;
        case "info":
          console.info(`${timestamp} ${prefix} ${message}`, data || "");
          break;
        case "warn":
          console.warn(`${timestamp} ${prefix} ${message}`, data || "");
          break;
        case "error":
          console.error(`${timestamp} ${prefix} ${message}`, data || "");
          break;
      }
    }

    // File output (optionnel)
    if (this.config.enableFile && this.config.filePath) {
      // Implémentation écriture fichier si nécessaire
    }
  }

  debug(module: string, message: string, data?: unknown): void {
    this.log("debug", module, message, data);
  }

  info(module: string, message: string, data?: unknown): void {
    this.log("info", module, message, data);
  }

  warn(module: string, message: string, data?: unknown): void {
    this.log("warn", module, message, data);
  }

  error(module: string, message: string, data?: unknown): void {
    this.log("error", module, message, data);
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter((log) => log.level === level);
    }
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }
}

// Logger singleton exporté
export const logger = new AutonomyLogger();

// Factory pour créer des loggers spécifiques aux modules
export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: unknown) => logger.debug(module, msg, data),
    info: (msg: string, data?: unknown) => logger.info(module, msg, data),
    warn: (msg: string, data?: unknown) => logger.warn(module, msg, data),
    error: (msg: string, data?: unknown) => logger.error(module, msg, data),
  };
}
