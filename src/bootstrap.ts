import "reflect-metadata"; /* The Reflect polyfill import should only be added once, and before DI is used: https://www.npmjs.com/package/tsyringe#installation */
import {container} from "tsyringe";

export async function Bootstrap() {
    return container;
}