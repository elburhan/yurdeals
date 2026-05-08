// ============================================
// Structured Logger Utility — YurDeals Backend
// ============================================

import fs from 'fs';
import path from 'path';
import { isDevelopment } from '../config';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogMeta = Record<string, unknown>;

const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';
const LOG_DIR = process.env.LOG_DIR?.trim() || path.resolve(process.cwd(), 'logs');

export const logger = {
  info(message: string, meta?: LogMeta): void {
    writeLog('info', message, meta);
  },

  warn(message: string, meta?: LogMeta): void {
    writeLog('warn', message, meta);
  },

  error(message: string, meta?: LogMeta): void {
    writeLog('error', message, meta);
  },

  debug(message: string, meta?: LogMeta): void {
    if (isDevelopment) {
      writeLog('debug', message, meta);
    }
  },
};

function writeLog(level: LogLevel, message: string, meta?: LogMeta): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry);

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }

  if (!LOG_TO_FILE) {
    return;
  }

  writeToDailyLogFile(line);
}

function writeToDailyLogFile(line: string): void {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const filePath = path.join(LOG_DIR, `backend-${dateStamp}.log`);
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  } catch (error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'log_file_write_failed',
        error: error instanceof Error ? error.message : 'Unknown log file error',
      }),
    );
  }
}
