// ==UserScript==
// @name         Soup's JS Console Utils
// @namespace    https://github.com/the-can-of-soup
// @version      1.1.0
// @description  Miscellaneous helpful JS utilities for browser consoles.
// @author       the-can-of-soup
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.soupConsoleUtils = {
        renameFunc(func, name) {
            // Return a wrapped version of function `func` that has name `name`.

            return {
                [name](...args) { return func.call(this, ...args); }
            }[name];
        },

        funcLogWrapper(func, name) {
            // Return a wrapped version of function `func` that will log to the console whenever it is
            // called.
            //
            // - `name` is optional and defaults to `func.name`; it determines the name used to identify
            //   the function in logs.

            function wrapped(...args) {
                let argsDisplay = [];
                for (let arg of args) {
                    argsDisplay.push(arg);
                    argsDisplay.push(',');
                }
                argsDisplay.pop();

                console.log(`${name ?? func.name}(`, ...argsDisplay, ')');
                let ret = func.call(this, ...args);
                console.log(`${name ?? func.name} ->`, ret);

                return ret;
            }

            return window.soupConsoleUtils.renameFunc(wrapped, func.name);
        },

        wrapInPlace(obj, key, wrapper, ...args) {
            // Apply wrapper func `wrapper` to object `obj[key]` and replace it in `obj`.
            //
            // - `args`: Additional arguments to pass to `wrapper`.

            obj[key] = wrapper(obj[key], ...args);
        },

        injectBreakpoint(func, after = false) {
            // Return a wrapped version of function `func` with a breakpoint added before it.
            //
            // - `after`: If true, a breakpoint is added after `func` as well as before.

            function wrapped(...args) {
                debugger;
                let ret = func.call(this, ...args);
                if (after) debugger;

                return ret;
            }

            return window.soupConsoleUtils.renameFunc(wrapped, func.name);
        },

        getAllPropertyNames(obj) {
            // Return an array of all property names of object `obj`, including inherited and
            // non-enumerable properties, except `__proto__`.

            const keys = [];
            while (obj !== null) {
                for (const key of Object.getOwnPropertyNames(obj)) {
                    if (!keys.includes(key) && key !== '__proto__') keys.push(key);
                }
                obj = Object.getPrototypeOf(obj);
            }

            return keys;
        },

        _crawlObjectPathDisplay(path) {
            let pathDisplay = ['<root>', '.'];
            for (let key of path) {
                pathDisplay.push(key ?? '<prototype>');
                pathDisplay.push('.');
            }
            pathDisplay.pop();

            return pathDisplay;
        },

        _getInheritedPropertyDescriptor(obj, key) {
            let descriptor = undefined;
            while (descriptor === undefined && obj !== null) {
                descriptor = Object.getOwnPropertyDescriptor(obj, key);
                obj = Object.getPrototypeOf(obj);
            }
            return descriptor;
        },

        crawlObject(root, handler, options = {}, _path = null, _discovered = null) {

            const {inherited = true, nonenumerable = true, getters = false, prototypes = false} = options;

            // Recursively crawl an object's properties and call a handler for each. Duplicate objects
            // are skipped, so self-referential objects may be safely crawled.
            //
            // - `root`: Object to crawl.
            // - `handler`: Function to call for each property. It is passed two arguments:
            //   - `value`: Property value.
            //   - `path`: Array of keys to get to the value from the root, ordered from shallow to
            //     deep.
            //   - Return: If true, the value and path are logged to the console.
            // - `options`: Options for what to include:
            //   - `inherited`: Whether to crawl inherited properties.
            //   - `nonenumerable`: Whether to crawl non-enumerable properties. `__proto__` is never
            //     crawled, even if this is true.
            //   - `getters`: Whether to crawl properties with `get` handlers. If 'log', errors in
            //     `get` handlers are also logged as warnings.
            //   - `prototypes`: Whether to crawl prototypes of objects. This step in the `path`
            //     passed to `handler` is represented by `null`.

            _path ??= [];
            _discovered ??= [];

            if (_discovered.includes(root)) return;

            const shouldLog = handler(root, _path);
            if (shouldLog) {
                console.log(...window.soupConsoleUtils._crawlObjectPathDisplay(_path), '=', root);
            }

            if (typeof root !== 'object' || root === null) return;
            _discovered.push(root);

            for (const key of inherited ? window.soupConsoleUtils.getAllPropertyNames(root) : Object.getOwnPropertyNames(root)) {
                let value;
                const subPath = _path.concat([key]);

                const descriptor = window.soupConsoleUtils._getInheritedPropertyDescriptor(root, key);
                if (!descriptor.enumerable) {
                    // Property is non-enumerable
                    if (!nonenumerable) continue;
                }
                if (descriptor.get !== undefined) {
                    // Property has a `get` handler
                    if (!getters) continue;
                    try {
                        value = root[key];
                    } catch (err) {
                        if (getters === 'log') {
                            console.warn(...window.soupConsoleUtils._crawlObjectPathDisplay(subPath), ': getter error:', err);
                        }
                        continue;
                    }
                } else {
                    value = root[key];
                }

                window.soupConsoleUtils.crawlObject(value, handler, options, subPath, _discovered);
            }

            if (prototypes) {
                const value = Object.getPrototypeOf(root);
                const subPath = _path.concat([null]);
                window.soupConsoleUtils.crawlObject(value, handler, options, subPath, _discovered);
            }
        },

        crawlMatch(substr, caseSensitive = false) {
            // Return a handler for `crawlObject` that logs each value whose key contains the
            // substring or regexp `substr`.
            //
            // - `substr`: Substring or regular expression to test against each key.
            // - `caseSensitive`: For string values of `substr`, whether the matching is case-
            //   sensitive.

            if (typeof substr === 'string') {
                if (!caseSensitive) substr = substr.toLowerCase();
            }

            function crawlLogMatchingHandler(value, path) {
                if (path.length === 0) return;

                let key = path[path.length - 1];
                if (key === null) return;

                if (typeof substr === 'string') {
                    if (!caseSensitive) key = key.toLowerCase();
                    return key.includes(substr);
                }
                return substr.test(key);
            }

            return crawlLogMatchingHandler;
        },
    };

    console.log('[Soup\'s JS Console Utils] Loaded; utilities are exposed at `soupConsoleUtils`.');
})();
