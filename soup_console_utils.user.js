// ==UserScript==
// @name         Soup's JS Console Utils
// @namespace    https://github.com/the-can-of-soup
// @version      1.7.0
// @description  Miscellaneous helpful JS utilities for browser consoles.
// @author       the-can-of-soup
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.soupConsoleUtils = {
        wrap(func, handler) {
            // Wrap function `func` using `handler`. The original unwrapped function may then be
            // accessed using `func.orig`.
            //
            // - `handler`: Function defining the wrapper behavior. It is passed two arguments:
            //   - `body`: Function that takes no arguments that will run the unwrapped function,
            //     passing along `this` and `args`, and returning its return value.
            //   - `args`: Arguments passed to the wrapped function.

            const wrapped = {
                [func.name](...args) {
                    return handler(() => func.call(this, ...args), args);
                }
            }[func.name];
            wrapped.orig = func;

            return wrapped;
        },

        asyncWrap(func, handler) {
            // Asynchronous version of `wrap`.
            //
            // Wrap async function `func` using `handler`. The original unwrapped function may
            // then be accessed using `func.orig`.
            //
            // - `handler`: Async function defining the wrapper behavior. It is passed two
            //   arguments:
            //   - `body`: Async function that takes no arguments that will run the unwrapped
            //     function, passing along `this` and `args`, and resolving/rejecting what it
            //     does.
            //   - `args`: Arguments passed to the wrapped function.

            const wrapped = {
                async [func.name](...args) {
                    return await handler(async () => await func.call(this, ...args), args);
                }
            }[func.name];
            wrapped.orig = func;

            return wrapped;
        },

        wrapInPlace(obj, key, wrapper, ...args) {
            // Apply wrapper func `wrapper` to value `obj[key]` and replace it in `obj`.
            //
            // - `args`: Additional arguments to pass to `wrapper`.

            obj[key] = wrapper(obj[key], ...args);
        },

        wrapAllMethods(obj, wrapper, ...args) {
            // Apply wrapper func `wrapper` to all function properties of object `obj`. The wrapped
            // methods are set directly on the object. Inherited methods are unaffected. `constructor`
            // is unaffected.
            //
            // - `args`: Additional arguments to pass to `wrapper`.
            // - Return the names of the methods that were wrapped, as an array.

            const methNames = [];
            
            for (let key of Object.getOwnPropertyNames(obj)) {
                if (key === 'constructor') continue;
                let meth = obj[key];
                if (typeof meth !== 'function') continue;
                obj[key] = wrapper(meth, ...args);

                methNames.push(key);
            }

            return methNames;
        },

        renameFunc(func, name) {
            // Return a wrapped version of function `func` that has name `name`. The original unwrapped
            // function can then be accessed with the `orig` property of the wrapped function.

            const wrapped = {
                [name](...args) { return func.call(this, ...args); }
            }[name];
            wrapped.orig = func;

            return wrapped;
        },

        unwrap(func) {
            // Return `func.orig`. Useful when used as a handler for functions like `wrapInPlace`.

            return func.orig;
        },

        logWrapper(func, name = null) {
            // Return a wrapped version of function `func` that will log to the console whenever it is
            // called, and when it returns or throws.
            //
            // - `name` is optional and defaults to `func.name`; it determines the name used to identify
            //   the function in logs.

            const effectiveName = name ?? func.name;

            return window.soupConsoleUtils.wrap(func, function(body, args) {
                let argsDisplay = [];
                for (let arg of args) {
                    argsDisplay.push(arg);
                    argsDisplay.push(',');
                }
                argsDisplay.pop();

                console.log(`${effectiveName}(`, ...argsDisplay, ')');
                let ret;
                try {
                    ret = body();
                } catch (err) {
                    console.log(`${effectiveName} throw ->`, err);
                    throw err;
                }

                console.log(`${effectiveName} ->`, ret);
                return ret;
            });
        },

        asyncLogWrapper(func, name = null) {
            // Asynchronous version of `logWrapper`.
            //
            // Return a wrapped version of async function `func` that will log to the console whenever
            // it is called, and when it resolves or rejects.

            const effectiveName = name ?? func.name;

            return window.soupConsoleUtils.asyncWrap(func, async function(body, args) {
                let argsDisplay = [];
                for (let arg of args) {
                    argsDisplay.push(arg);
                    argsDisplay.push(',');
                }
                argsDisplay.pop();

                console.log(`await ${effectiveName}(`, ...argsDisplay, ')');
                let ret;
                try {
                    ret = await body();
                } catch (err) {
                    console.log(`await ${effectiveName} reject ->`, err);
                    throw err;
                }
                console.log(`await ${effectiveName} ->`, ret);

                return ret;
            });
        },

        injectBreakpoint(func, after = false) {
            // Return a wrapped version of function `func` with a breakpoint added before it.
            //
            // - `after`: If true, a breakpoint is added after `func` as well as before.

            return window.soupConsoleUtils.wrap(func, function(body, args) {
                debugger;
                let ret = body();
                if (after) debugger;

                return ret;
            });
        },

        asyncInjectBreakpoint(func, after = false) {
            // Asynchronous version of `injectBreakpoint`.
            //
            // Return a wrapped version of async function `func` with a breakpoint added
            // before it.
            //
            // - `after`: If true, a breakpoint is added after `func` as well as before.

            return window.soupConsoleUtils.asyncWrap(func, async function(body, args) {
                debugger;
                let ret = await body();
                if (after) debugger;

                return ret;
            });
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

        getInheritedPropertyDescriptor(obj, key) {
            // Return the property descriptor of property with name `key` on object `obj`, including
            // inherited properties. Return is the same format as `Object.getOwnPropertyDescriptor`.

            let descriptor = undefined;
            while (descriptor === undefined && obj !== null) {
                descriptor = Object.getOwnPropertyDescriptor(obj, key);
                obj = Object.getPrototypeOf(obj);
            }
            return descriptor;
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

        crawlObject(root, handler, options = {}, _path = null, _discovered = null) {
            const {inherited = true, nonenumerable = true, getters = false, prototypes = false, maxDepth = null} = options;
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
            //   - `maxDepth`: Maximum depth of the search; values at this depth are handled, but no
            //     deeper. Null removes the limit.

            _path ??= [];
            _discovered ??= [];

            if (_discovered.includes(root)) return;

            const shouldLog = handler(root, _path);
            if (shouldLog) {
                console.log(...window.soupConsoleUtils._crawlObjectPathDisplay(_path), '=', root);
            }

            if (typeof root !== 'object' || root === null) return;
            _discovered.push(root);

            if (maxDepth !== null && _path.length >= maxDepth) return;

            for (const key of inherited ? window.soupConsoleUtils.getAllPropertyNames(root) : Object.getOwnPropertyNames(root)) {
                let value;
                const subPath = _path.concat([key]);

                const descriptor = window.soupConsoleUtils.getInheritedPropertyDescriptor(root, key);
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
            // substring or matches the regexp `substr`.
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
