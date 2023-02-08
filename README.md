JavaScript interface for MiniZinc
=================================

[![Latest documentation](https://img.shields.io/badge/docs-latest-blue)](https://js.minizinc.dev/docs/stable)
[![Latest package](https://img.shields.io/npm/v/minizinc/latest?color=blue)](https://www.npmjs.com/package/minizinc)
[![Edge documentation](https://img.shields.io/badge/docs-edge-orange)](https://js.minizinc.dev/docs/develop)
[![Edge package](https://img.shields.io/npm/v/minizinc/edge?color=orange)](https://www.npmjs.com/package/minizinc)

This package provides a JavaScript API for [MiniZinc](https://minizinc.dev)
for use in web browsers using WebAssembly, or in NodeJS using a native
installation of MiniZinc.

This library powers the [MiniZinc Playground](https://minizinc.dev/solve).

## Getting started

### Using a CDN (recommended)

Using ECMAScript modules:

```html
<script type="module">
  import { Model } from 'https://cdn.jsdelivr.net/npm/minizinc/dist/minizinc.mjs';
  const model = new Model();
  model.addFile('test.mzn', 'var 1..3: x;');
  const solve = model.solve({
    options: {
      solver: 'gecode',
      'all-solutions': true
    }
  });
  solve.on('solution', solution => {
    console.log(solution.output.json);
  });
  solve.then(result => {
    console.log(result.status);
  });
</script>
```

Using a traditional script:

```html
<script src="https://cdn.jsdelivr.net/npm/minizinc/dist/minizinc.js"></script>
<script>
  const model = new MiniZinc.Model();
  model.addFile('test.mzn', 'var 1..3: x;');
  const solve = model.solve({
    options: {
      solver: 'gecode',
      'all-solutions': true
    }
  });
  solve.on('solution', solution => {
    console.log(solution.output.json);
  });
  solve.then(result => {
    console.log(result.status);
  });
</script>
```

### Self-hosting WebAssembly files

If you're using a bundler, you can add the library to your project:

```sh
npm install minizinc
```

Then import it with:

```js
import * as MiniZinc from 'minizinc';
```

These three files need to be served by your webserver (found in `node_modules/minizinc/dist`):

- `minizinc-worker.js`
- `minizinc.wasm`
- `minizinc.data`

If you place them alongside your bundled script, they should be found automatically.
Otherwise, their URLs can be specified during [initialisation](#initialisation).

### In NodeJS

This requires an existing [installation of MiniZinc](https://github.com/MiniZinc/MiniZincIDE/releases).

Add the library with:

```sh
npm install minizinc
```

Then import it with:

```js
// If using ESM
import * as MiniZinc from 'minizinc';
// If using CommonJS
const MiniZinc = require('minizinc');
```

If you have added MiniZinc to your `PATH`, it will be found automatically.
Otherwise, you can specify the executable path during [initialisation](#initialisation).

## Usage

### Initialisation

Initialisation happens automatically when the library is used, or by calling
[`init(...)`](https://js.minizinc.dev/docs/stable/functions/init.html). This can used to ensure
that the WebAssembly files start loading immediately, or to specify a different URL for the worker
(or path to the MiniZinc executable if using NodeJS).

In the browser:

```js
MiniZinc.init({
  // If omitted, searches for minizinc-worker.js next to the minizinc library script
  workerURL: 'http://localhost:3000/path/to/my-own-worker.js',
  // If these are omitted, searches next to the worker script
  wasmURL: 'http://localhost:3000/path/to/minizinc.wasm',
  dataURL: 'http://localhost:3000/path/to/minizinc.data'
}).then(() => {
  console.log('Ready');
});
```

In NodeJS:

```js
MiniZinc.init({
  // Executable name
  minizinc: 'minizinc',
  // Search paths (can omit to use PATH)
  minizincPaths: ['/home/me/.local/bin', '/usr/local/bin']
});
```

By default, the NodeJS version tries to find MiniZinc on your `PATH`.

### Creating Models

The main entrypoint for using the library is through the
[`Model`](https://js.minizinc.dev/docs/stable/classes/Model.html) class:

```js
const model = new MiniZinc.Model();
// Add a file with a given name and string contents
model.addFile('test.mzn', 'var 1..3: x; int: y;');
// If you're using NodeJS, you can add files from the filesystem directly
model.addFile('test.mzn');
// Add model code from a string
model.addString('int: z;');
// Add data in DZN format
model.addDznString('y = 1;');
// Add data from a JSON object
model.addJSON({z: 2});
```

### Solving

Solving is done using the [`Model.solve(...)`](https://js.minizinc.dev/docs/stable/classes/Model.html#solve) method,
which takes an object with `options` in [`.mpc`](https://minizinc.dev/doc-latest/en/command_line.html#ch-param-files)
format.

```js
const solve = model.solve({
  options: {
    solver: 'gecode',
    timeout: 10000,
    statistics: true
  }
});
// You can listen for events
solve.on('solution', solution => console.log(solution.output.json));
solve.on('statistics', stats => console.log(stats.statistics));
// And/or wait until complete
solve.then(result => {
  console.log(result.solution.output.json);
  console.log(result.statistics);
});
```

During solving, MiniZinc emits events which can be subscribed to/unsubscribed from using the
[`SolveProgress.on`](https://js.minizinc.dev/docs/stable/interfaces/SolveProgress.html#on) /
[`SolveProgress.off`](https://js.minizinc.dev/docs/stable/interfaces/SolveProgress.html#off)
methods. The events are those which appear in
[Machine-readable JSON output format](https://minizinc.dev/doc-latest/en/json-stream.html),
with the addition of the [`exit`](https://js.minizinc.dev/docs/stable/interfaces/ExitMessage.html)
event, which can be used to detect when solving finishes (if you do not wish to await the 
[`SolveProgress`](https://js.minizinc.dev/docs/stable/interfaces/SolveProgress.html) object).

By default, `--output-mode json` is used, allowing you to retrieve the model variable values
directly from the solution objects. Use
[`Model.solve({ jsonOutput: false, ...})`](https://js.minizinc.dev/docs/stable/classes/Model.html#solve)
(and optionally specify a different `output-mode` in the `options`) to disable this behaviour.

## Documentation

For more detailed documentation of all available options and functionality, visit the 
[API documentation](https://js.minizinc.dev/docs/stable/).

## Building

1. Run `npm install` to install dependencies.
2. Place the `bin/` folder of the WebAssembly build of MiniZinc inside this directory.
   Alternatively set the `MZN_WASM_DIR` environment variable to the installation directory of the
   WebAssembly build of MiniZinc.
3. Run `npm run build` to build the package. The built files are in the `dist/` directory.
4. Run `npm run docs` to build the documentation. The output files are in the `docs/` directory.

## Testing

When testing, the [`web-worker`](https://www.npmjs.com/package/web-worker) library is used to emulate Web Worker
support in NodeJS. This allows us to test both the browser version using WebAssembly, as well as the native version.

Run `npm test` to run tests using [Jest](https://jestjs.io).

## License

This library is distributed under the Mozilla Public License Version 2.0. See LICENSE for more information.
