//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

import {
    IHttpPipeline,
    IHttpRequest,
    IHttpResponse,
    HttpRequestHandler,
    HttpResponseHandler
} from "donut.node/http";

import { ILog } from "donut.node/logging";

export default class HttpPipeline implements IHttpPipeline {
    public requestTemplate: IHttpRequest;

    protected readonly log: ILog;

    private readonly _requestHandlers: Array<HttpRequestHandler>;

    private readonly _responseHandlers: Array<HttpResponseHandler>;

    constructor(log: ILog, requestHandlers?: Array<HttpRequestHandler>, responseHandlers?: Array<HttpResponseHandler>) {
        this.log = log;
        this._requestHandlers = [];
        this._responseHandlers = [];

        if (requestHandlers) {
            this._requestHandlers.push(...requestHandlers);
        }

        if (responseHandlers) {
            this._responseHandlers.push(...responseHandlers);
        }
    }

    public get requestHandlers(): Array<HttpRequestHandler> {
        return this._requestHandlers;
    }

    public get responseHandlers(): Array<HttpResponseHandler> {
        return this._responseHandlers;
    }

    public async requestAsync(request: IHttpRequest): Promise<IHttpResponse> {
        if (this.requestTemplate) {
            const headers = [];

            if (this.requestTemplate.headers) {
                headers.push(...this.requestTemplate.headers);
            }

            if (request.headers) {
                headers.push(...headers);
            }

            request = Object.assign(Object.create(null), this.requestTemplate, request);
            request.headers = headers;
        }

        this.log.writeInfoAsync(`HTTP ${request.method} => ${request.url}`);

        let response: IHttpResponse;

        for (const handleRequestAsync of this._requestHandlers) {
            response = await handleRequestAsync(this, request);

            if (response) {
                break;
            }
        }

        if (!response) {
            throw new Error("No request handler handled request.");
        }

        this.log.writeInfoAsync(`HTTP ${response.statusCode} ${response.statusMessage} of HTTP ${request.method} => ${request.url}`);

        for (const handleResponseAsync of this._responseHandlers) {
            response = await handleResponseAsync(this, request, response) || response;
        }

        return response;
    }
}
