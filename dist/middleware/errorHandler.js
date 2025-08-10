"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("../utils/logger"));
const { logger, httpLogger } = logger_1.default;
const errorTypes_1 = __importDefault(require("../utils/errorTypes"));
const { ApiError } = errorTypes_1.default;
/**
 * Central error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    // If the error is operational, log it as a warning, otherwise as an error
    if (err instanceof ApiError && err.isOperational) {
        logger.warn({
            message: err.message,
            statusCode: err.statusCode,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
    }
    else {
        logger.error({
            message: err.message,
            stack: err.stack,
            path: req.path,
            method: req.method,
            ip: req.ip
        });
    }
    // Handle Sequelize validation errors
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.errors.map((e) => ({
                field: e.path,
                message: e.message
            }))
        });
    }
    // Handle Sequelize unique constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            success: false,
            message: 'Duplicate resource',
            errors: err.errors.map((e) => ({
                field: e.path,
                message: e.message
            }))
        });
    }
    // Handle custom API errors
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message
        });
    }
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
    // Handle token expiration
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }
    // For any other error, return 500 Internal Server Error
    return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
};
exports.default = errorHandler;
