//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

declare module "donut.node/http" {
    import { IDictionary } from "donut.node/common";
    import { ICertificate, ICertificateInfo } from "donut.node/cert";

    export type SslVersion =
        "TLS" | "TLS1.2" | "TLS1.1" | "TLS1.0" | "SSL3.0";

    export type HttpMethod =
        "GET" | "POST" | "PUT" | "PATCH" | "DELETE" |
        "HEAD" | "CONNECT" | "OPTIONS" | "TRACE";

    export interface IHttpHeader {
        name: string;
        value: string;
    }

    export interface IHttpResponse {
        httpVersion: string;
        statusCode: number;
        statusMessage: string;

        data: any;

        headers: Array<IHttpHeader>;
        body: Buffer;
    }

    export interface IHttpRequest {
        sslVersion?: SslVersion;
        clientCert?: ICertificate;

        method: HttpMethod;
        url: string;
        headers?: Array<IHttpHeader>;
        body?: any;
    }

    export interface IHttpPipeline {
        requestTemplate: IHttpRequest;

        readonly requestHandlers: Array<HttpRequestHandler>;

        readonly responseHandlers: Array<HttpResponseHandler>;

        requestAsync(request: IHttpRequest): Promise<IHttpResponse>;
    }

    export interface IHttpClient {
        getRequestTemplateAsync(): Promise<IHttpRequest>;

        setRequestTemplateAsync(template: IHttpRequest): Promise<void>;
        
        getAsync<T>(url: string): Promise<T>;

        postAsync<T>(url: string, data: any): Promise<T>;

        putAsync<T>(url: string, data: any): Promise<T>;

        patchAsync<T>(url: string, data: any): Promise<T>;

        deleteAsync<T>(url: string): Promise<T>;

        headAsync<T>(url: string): Promise<T>;

        optionsAsync<T>(url: string, data: any): Promise<T>;

        traceAsync<T>(url: string, data: any): Promise<T>;

        requestAsync(request: IHttpRequest): Promise<IHttpResponse>;
    }

    export type HttpRequestHandler = (pipleline: IHttpPipeline, request: IHttpRequest) => Promise<IHttpResponse>;

    export type HttpResponseHandler = (pipleline: IHttpPipeline, request: IHttpRequest, response: IHttpResponse) => Promise<IHttpResponse>;

    export type ServerCertValidator = (serverName: string, cert: ICertificateInfo) => boolean;

    export type ClientCertSelector = (url: string, certInfos: Array<ICertificateInfo>) => Promise<ICertificate | ICertificateInfo>;
}

declare module "donut.node/module-manager" {
    import {
        IHttpClient,
        HttpRequestHandler,
        HttpResponseHandler,
        ServerCertValidator,
        ClientCertSelector
    } from "donut.node/http";

    export interface IModuleManager {
        getComponentAsync(componentIdentity: "http.http-client", requestHandlers?: Array<HttpRequestHandler>, responseHandlers?: Array<HttpResponseHandler>): Promise<IHttpClient>;
        getComponentAsync(componentIdentity: "http.http-client.service-fabric"): Promise<IHttpClient>;
    }
}
