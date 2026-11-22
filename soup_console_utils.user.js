// ==UserScript==
// @name         Soup's JS Console Utils
// @namespace    https://github.com/the-can-of-soup
// @version      1.0.2
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

        crawlObject(root, handler, prototypes = false, _path = null, _discovered = null) {
            // Recursively crawl an object's items and call a handler for each. Duplicate objects are
            // skipped, so self-referential objects may be safely crawled.
            //
            // - `root`: Object to crawl.
            // - `handler`: Function to call for each item. It is passed two arguments:
            //   - `value`: Value.
            //   - `path`: Array of keys to get to the value from the root, ordered from shallow to
            //     deep.
            //   - Return: If true, the value and path are logged to the console.
            // - `prototypes`: If true, prototypes of objects will also be crawled. This step in `path`
            //   is represented by `null`.

            _path ??= [];
            _discovered ??= [];

            if (_discovered.includes(root)) return;

            let shouldLog = handler(root, _path);
            if (shouldLog) {
                let pathDisplay = ['<root>', '.'];
                for (let key of _path) {
                    pathDisplay.push(key ?? '<prototype>');
                    pathDisplay.push('.');
                }
                pathDisplay.pop();

                console.log(...pathDisplay, '=', root);
            }

            if (typeof root !== 'object' || root === null) return;
            _discovered.push(root);

            for (let key in root) {
                let value = root[key];
                let subPath = _path.concat([key]);
                window.soupConsoleUtils.crawlObject(value, handler, prototypes, subPath, _discovered);
            }

            if (prototypes) {
                let value = Object.getPrototypeOf(root);
                let subPath = _path.concat([null]);
                window.soupConsoleUtils.crawlObject(value, handler, prototypes, subPath, _discovered)
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

    console.log('[Soup\'s JS Console Utils] Loaded; utilities are exposed at `soupConsoleUtils`.'
        + ' Read the userscript source code for comments explaining the usage of these.');
})();
