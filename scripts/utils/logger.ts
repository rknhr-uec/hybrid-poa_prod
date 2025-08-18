import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format (includes module name if present)
const logFormat = printf((info) => {
	const { level, message, timestamp, stack, module } = info as any;
	const moduleSegment = module ? ` [${module}]` : '';
	return `${timestamp} [${level}]${moduleSegment}: ${stack || message}`;
});

// Create logger instance
export const logger = winston.createLogger({
	level: process.env.LOG_LEVEL || 'info',
	format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
	transports: [
		new winston.transports.Console({
			format: combine(
				colorize(),
				timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
				errors({ stack: true }),
				logFormat,
			),
		}),
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
		}),
	],
});
