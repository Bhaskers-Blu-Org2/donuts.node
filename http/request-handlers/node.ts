//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

import {
    IHttpPipeline,
    IHttpRequest,
    IHttpResponse,
    IHttpHeader,
    ServerCertValidator,
    HttpRequestHandler
} from "donut.node/http";

import { IPemCertificate, IPfxCertificate, ICertificateInfo } from "donut.node/cert";

import * as url from "url";
import * as http from "http";
import * as https from "https";
import * as crypto from "crypto";
import * as tls from "tls";

function applyHeaders(requestHeaders: http.OutgoingHttpHeaders, headers: Array<IHttpHeader>): void {
    for (const header of headers) {
        let requestHeader: any = requestHeaders[header.name];

        if (Array.isArray(requestHeader)) {
            requestHeader.push(header.value);

        } else if (requestHeader !== undefined && requestHeader !== null) {
            requestHeader = [requestHeader, header.value];
            requestHeaders[header.name] = requestHeader;

        } else {
            requestHeaders[header.name] = header.value;
        }
    }
}

function generateHeaders(headers: Array<string>): Array<IHttpHeader> {
    let header: IHttpHeader;
    const generatedHeaders: Array<IHttpHeader> = [];

    for (let valueIndex = 0; valueIndex < headers.length; valueIndex++) {
        if (valueIndex % 2 === 0) {
            header = Object.create(null);
            header.name = headers[valueIndex];
        } else {
            header.value = headers[valueIndex];
            generatedHeaders.push(header);
        }
    }

    return generatedHeaders;
}

function generateBodyAsync(httpResponse: http.IncomingMessage): Promise<Buffer> {
    if (!httpResponse.readable) {
        return Promise.resolve(new Buffer(0));
    }

    return new Promise<Buffer>((resolve, reject) => {
        const bodyData: Array<number> = [];

        httpResponse.on("data", (chunk: Buffer) => {
            bodyData.push(...chunk);
        });

        httpResponse.on("end", () => resolve(new Buffer(bodyData)));

        httpResponse.on("error", (err) => reject(err));
    });
}

function handleRequestAsync(validateServerCert: ServerCertValidator, pipeline: IHttpPipeline, request: IHttpRequest): Promise<IHttpResponse> {
    return new Promise((resolve, reject) => {
        const options: http.RequestOptions = Object.assign(Object.create(null), url.parse(request.url));
        let httpRequest: http.ClientRequest;
        let body: string | Buffer;

        if (Buffer.isBuffer(request.body) || typeof request.body === "string") {
            body = request.body;

        } else {
            body = JSON.stringify(request.body);

            if (!request.headers) {
                request.headers = [];
            }

            const headerIndex = request.headers.findIndex((value) => value.name === "Content-Type");
            const contentTypeHeader: IHttpHeader = headerIndex < 0 ? Object.create(null) : request.headers[headerIndex];

            contentTypeHeader.name = "Content-Type";
            contentTypeHeader.value = "application/json; charset=utf-8";

            if (headerIndex >= 0) {
                request.headers[headerIndex] = contentTypeHeader;
            } else {
                request.headers.push(contentTypeHeader);
            }
        }

        options.method = request.method;

        if (request.headers) {
            options.headers = Object.create(null);
            applyHeaders(options.headers, request.headers);
        }

        if (options.protocol === "http:") {
            httpRequest = http.request(options);

        } else if (options.protocol === "https:") {

            if (request.sslVersion) {
                options["secureProtocol"] = request.sslVersion;
            }

            if (validateServerCert) {
                options["rejectUnauthorized"] = false;
            }

            if (request.clientCert) {
                if (request.clientCert.type === "pem") {
                    const pemCert = <IPemCertificate>request.clientCert;

                    options["cert"] = pemCert.cert;

                    if (pemCert.key) {
                        options["key"] = pemCert.key;
                    }

                    if (pemCert.password) {
                        options["passphrase"] = pemCert.password;
                    }

                } else if (request.clientCert.type === "pfx") {
                    const pemCert = <IPfxCertificate>request.clientCert;

                    options["pfx"] = pemCert.pfx;

                    if (pemCert.password) {
                        options["passphrase"] = pemCert.password;
                    }

                } else {
                    reject(new Error(`Invalid clientCert.type: ${request.clientCert.type}`));
                    return;
                }
            }

            try {
                httpRequest = https.request(options);
            } catch (err) {
                if (err && err.message === "mac verify failure") {
                    delete options["key"];
                    delete options["cert"];
                    delete options["passphrase"];
                    delete options["pfx"];

                    httpRequest = https.request(options);

                } else {
                    reject(err);
                    return undefined;
                }
            }

        } else {
            return undefined;
        }

        httpRequest.on("response", async (response: http.IncomingMessage) => {
            const httpResponse: IHttpResponse = Object.create(null);

            httpResponse.httpVersion = response.httpVersion;
            httpResponse.statusCode = response.statusCode;
            httpResponse.statusMessage = response.statusMessage;
            httpResponse.headers = generateHeaders(response.rawHeaders);
            httpResponse.body = await generateBodyAsync(response);

            resolve(httpResponse);
        });

        if (options.protocol === "https:" && validateServerCert) {
            httpRequest.on("socket", (socket: tls.TLSSocket) => {
                socket.once("secureConnect", () => {
                    if (!socket.authorized) {
                        const peerCert = socket.getPeerCertificate();

                        if (Object.isEmpty(peerCert)) {
                            return;
                        }

                        const host = url.parse(request.url).host;

                        if (!validateServerCert(host, toCertificateInfo(peerCert))) {
                            socket.destroy(socket.authorizationError);
                        }
                    }
                });
            });
        }

        httpRequest.on("error", (error) => reject(error));

        if (body) {
            httpRequest.write(body);
        }

        httpRequest.end();
    });
}

function objectToString(obj: any): string {
    const propertyNames = Object.getOwnPropertyNames(obj);
    let str = "";

    for (const propertyName of propertyNames) {
        str += `${propertyName}=${obj[propertyName]}, `;
    }

    return str.substr(0, str.length - 2);
}

function toCertificateInfo(cert: tls.PeerCertificate): ICertificateInfo {
    const sha1 = crypto.createHash("sha1");

    sha1.update(cert.raw);

    return {
        subjectName: objectToString(cert.subject),
        issuerName: objectToString(cert.issuer),
        serialNumber: cert.serialNumber,
        validStart: new Date(cert.valid_from),
        validExpiry: new Date(cert.valid_to),
        thumbprint: sha1.digest("hex")
    };
}

export default function createRequestHandler(serverCertValidator?: ServerCertValidator): HttpRequestHandler {
    if (serverCertValidator) {
        return handleRequestAsync.bind(undefined, serverCertValidator);
    }

    return handleRequestAsync.bind(undefined, undefined);
}
