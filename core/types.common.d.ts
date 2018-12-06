//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

namespace Donuts {
    type FunctionType = (...args: Array<any>) => any;

    interface IStringKeyDictionary<TValue> {
        [index: string]: TValue;
    }

    interface INumberKeyDictionary<TValue> {
        [index: number]: TValue;
    }

    interface ISymbolKeyDictionary<TValue> {
        [index: symbol]: TValue;
    }

    interface IDisposable {
        disposeAsync(): Promise<void>;
    }

    interface IEventEmitter {
        preOn(event: string, handler: (...args: Array<any>) => any): this;
        preOnce(event: string, handler: (...args: Array<any>) => any): this;
        on(event: string, handler: (...args: Array<any>) => any): this;
        once(event: string, handler: (...args: Array<any>) => any): this;
        off(event: string, handler: (...args: Array<any>) => any): this;

        emit(event: string, ...args: Array<any>): any;
    }

    type ConditionalOperator = "AND" | "OR";

    interface ICondition<T> {
        match(input: T): boolean;
    }
}