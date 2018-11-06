//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------
'use strict';

const path = require("path");
const utils = require("../utils");
const { ConsoleLogger } = require("./loggers/console");

/**
 * @class
 * @implements {Donuts.Logging.ILog}
 */
class Log {
    /**
     * @public
     * @returns {Donuts.Logging.ILog}
     */
    static get instance() {
        if (!Log._instance) {
            Log._instance = new Log();
        }

        return Log._instance;
    }

    /**
     * @private
     * @param {Error} error 
     * @param {Array.<NodeJS.CallSite>} structuredStackTrace 
     * @returns {*}
     */
    static prepareStackTraceOverride(error, structuredStackTrace) {
        return structuredStackTrace;
    }

    /**
     * @private
     * @returns {import("../utils").CallerInfo}
     */
    static getCallerModuleInfo() {
        const previousPrepareStackTraceFn = Error.prepareStackTrace;

        try {
            Error.prepareStackTrace = Log.prepareStackTraceOverride;

            /** @type {Array.<NodeJS.CallSite>} */
            // @ts-ignore
            const callStack = (new Error()).stack;

            for (let callStackIndex = 0; callStackIndex < callStack.length; callStackIndex++) {
                const stack = callStack[callStackIndex];
                const stackFileName = stack.getFileName();

                if (!stackFileName.startsWith(path.dirname(module.filename))) {
                    return {
                        fileName: stackFileName,
                        functionName: stack.getFunctionName(),
                        typeName: stack.getTypeName(),
                        lineNumber: stack.getLineNumber(),
                        columnNumber: stack.getColumnNumber()
                    };
                }
            }

            return undefined;
        } finally {
            Error.prepareStackTrace = previousPrepareStackTraceFn;
        }
    }

    /**
     * @private
     * @param {*} obj 
     * @returns {string}
     */
    static stringifier(obj) {
        if (obj instanceof Error) {
            const errorObj = Object.create(null);

            errorObj.message = obj.message;
            errorObj.name = obj.name;

            if ("stack" in obj) {
                errorObj.stack = obj.stack;
            }

            if ("code" in obj) {
                errorObj.code = obj["code"];
            }

            obj = errorObj;
        }

        return utils.string.stringifier(obj);
    }
    
    /**
     * @public
     * @param {boolean} [includeCallerInfo]
     * @param {Object.<string, *>} [defaultProperties]
     */
    constructor(includeCallerInfo, defaultProperties) {
        /** @type {Array.<Donuts.Logging.ILogger>} */
        this.loggers = undefined;

        /** @type {Object.<string, *>} */
        this.defaultProperties = undefined;

        /** @type {boolean} */
        this.loggCallerInfo = false;

        if (!utils.isNullOrUndefined(defaultProperties)
            && !utils.isObject(defaultProperties)) {
            throw new Error("defaultProperties must be an object.");
        }

        this.loggers = [];
        this.defaultProperties = defaultProperties;
        this.logCallerInfo = includeCallerInfo === true;

        this.addLoggerAsync(new ConsoleLogger());
    }

    /**
     * @public
     * @param {Object.<string, string>} properties 
     * @param {Donuts.Logging.Severity} severity 
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise<void>}
     */
    async writeMoreAsync(properties, severity, messageOrFormat, ...params) {
        if (!utils.isString(messageOrFormat)) {
            return;
        }

        if (Array.isArray(params) && params.length > 0) {
            messageOrFormat = utils.string.formatEx(Log.stringifier, messageOrFormat, ...params);
        }

        properties = this.generateProperties(properties);

        await Promise.all(this.loggers.map((logger) => logger.writeAsync(properties, severity, messageOrFormat)));
    }

    /**
     * @public
     * @param {Donuts.Logging.Severity} severity 
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise<void>}
     */
    writeAsync(severity, messageOrFormat, ...params) {
        return this.writeMoreAsync(null, severity, messageOrFormat, ...params);
    }

    /**
     * @public
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise.<void>}
     */
    writeInfoAsync(messageOrFormat, ...params) {
        return this.writeAsync("info", messageOrFormat, ...params);
    }

    /**
     * @public
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise.<void>}
     */
    writeVerboseAsync(messageOrFormat, ...params) {
        return this.writeAsync("verbose", messageOrFormat, ...params);
    }

    /**
     * @public
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise.<void>}
     */
    writeWarningAsync(messageOrFormat, ...params) {
        return this.writeAsync("warning", messageOrFormat, ...params);
    }

    /**
     * @public
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise<void>}
     */
    writeErrorAsync(messageOrFormat, ...params) {
        return this.writeAsync("error", messageOrFormat, ...params);
    }

    /**
     * @public
     * @param {string} messageOrFormat 
     * @param {...*} params 
     * @returns {Promise<void>}
     */
    writeCriticalAsync(messageOrFormat, ...params) {
        return this.writeAsync("critical", messageOrFormat, ...params);
    }

    /**
     * @public
     * @param {Error} exception 
     * @param {Object.<string, string>} [properties]
     * @returns {Promise.<void>}
     */
    async writeExceptionAsync(exception, properties) {
        properties = this.generateProperties(properties);

        await Promise.all(this.loggers.map((logger) => logger.writeExceptionAsync(properties, exception)));
    }

    /**
     * @public
     * @param {string} name 
     * @param {Object.<string, string>} [properties]
     * @returns {Promise.<void>}
     */
    async writeEventAsync(name, properties) {
        if (!utils.isString(name)) {
            return;
        }

        properties = this.generateProperties(properties);

        await Promise.all(this.loggers.map((logger) => logger.writeAsync(properties, "event", name)));
    }

    /**
     * @public
     * @param {string} name 
     * @param {number} [value]
     * @param {Object.<string, string>} [properties]
     * @returns {Promise.<void>}
     */
    async writeMetricAsync(name, value, properties) {
        if (!utils.isString(name)) {
            return;
        }

        if (!utils.isNumber(value)) {
            value = 1;
        }

        properties = this.generateProperties(properties);

        await Promise.all(this.loggers.map((logger) => logger.writeMetricAsync(properties, name, value)));
    }

    /**
     * @public
     * @param {string} name 
     * @returns {Promise.<Donuts.Logging.ILogger>}
     */
    async removeLoggerAsync(name) {
        if (!utils.isString(name)) {
            throw new Error("name must be supplied.");
        }

        for (let loggerIndex = 0; loggerIndex < this.loggers.length; loggerIndex++) {
            const logger = this.loggers[loggerIndex];

            if (name === logger.name) {
                return this.loggers.splice(loggerIndex, 1)[0];
            }
        }

        return undefined;
    }

    /**
     * @public
     * @param {Donuts.Logging.ILogger} logger 
     * @returns {Promise.<void>}
     */
    async addLoggerAsync(logger) {
        if (!logger) {
            throw new Error("logger must be provided.");
        }

        if (!utils.isObject(logger)) {
            throw new Error("logger must be an object implementing ILogger.");
        }

        this.loggers.push(logger);
    }

    /**
     * @private
     * @param {Object.<string, string>} properties 
     * @returns {Object.<string, string>}
     */
    generateProperties(properties) {
        /** @type {Object.<string, string>} */
        let finalProperties = null;

        if (this.defaultProperties) {
            finalProperties = Object.create(this.defaultProperties);
        }

        if (utils.isObject(properties)) {
            finalProperties = finalProperties || Object.create(null);
            finalProperties = Object.assign(finalProperties, properties);
        }

        if (this.logCallerInfo) {
            const callerInfo = Log.getCallerModuleInfo();

            if (callerInfo) {
                const typeName = callerInfo.typeName || "";
                let functionName = callerInfo.functionName;

                if (!functionName) {
                    functionName = `<Anonymous>@{${callerInfo.lineNumber},${callerInfo.columnNumber}}`;
                }

                finalProperties = finalProperties || Object.create(null);
                finalProperties["Caller.FileName"] = callerInfo.fileName;

                if (!utils.string.isEmptyOrWhitespace(typeName)) {
                    finalProperties["Caller.Name"] = `${typeName}.`;
                } else {
                    finalProperties["Caller.Name"] = "";
                }

                finalProperties["Caller.Name"] += `${functionName}()`;
            }
        }

        return finalProperties;
    }
}
exports.Log = Log;

/** @type {Donuts.Logging.ILog} */
Log._instance = undefined;