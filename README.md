JavaScript interface for MiniZinc
=================================

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

Using the traditional script:

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

Three files must be hosted from the same directory:

- `dist/minizinc-worker.js`
- `dist/minizinc.wasm`
- `dist/minizinc.data`

The URL of the `minizinc-worker.js` script must be passed as the argument to
a call to `MiniZinc.init(url);` if the files are not located next to the
`minizinc.js` script (or the bundled script if using a bundler). See the section
on initialisation below for more information.

### In NodeJS

```js
import { Model } from 'minizinc';
const model = new Model();
model.addFile('test.mzn');
model.solve({
  options: {
    solver: 'gecode'
  }
}).then(result => {
  console.log(result);
});
```

## Usage

### Initialisation

Initialisation happens automatically when the library is used, or by calling
`init(...)`. This can used to ensure that the WebAssembly files start loading
immediately, or to specify a different URL for the worker (or path to the
MiniZinc executable if using NodeJS).

In the browser:

```js
// Note that `minizinc.wasm` and `minizinc.data` will be loaded from
// `http://localhost:3000/path/to/minizinc.wasm` and
// `http://localhost:3000/path/to/minizinc.data` respectively
MiniZinc.init({
  workerURL: 'http://localhost:3000/path/to/my-own-worker.js'
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

The main entrypoint for using the library is through the `Model` class:

```js
const model = new MiniZinc.Model();
// Add a file with a given name and string contents
model.addFile('test.mzn', 'var 1..3: x; int: y;');
// Add model code from a string
model.addString('int: z;');
// Add data in DZN format
model.addDznString('y = 1;');
// Add data from a JSON object
model.addJSON({z: 2});
```

### Solving

Solving is done using the `Model.solve(...)` method, which takes an object in
[`.mpc`](https://minizinc.dev/doc-latest/en/command_line.html#ch-param-files)
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

During solving, MiniZinc emits events which can be subscribed to/unsubscribed from
using the `Solver.on`/`Solver.off` methods. The events are those which appear in
[Machine-readable JSON output format](https://minizinc.dev/doc-latest/en/json-stream.html),
with the addition of the `exit` event, which can be used to detect when solving finishes (if you do
not wish to await the `Solve` object).

By default, `--output-mode json` is used. Use `Model.solve({ jsonOutput: false, ...})` to
disable this behaviour.

## Building

1. Run `npm install` to install dependencies.
2. Place the `bin/` folder of the WebAssembly build of MiniZinc inside this directory.
3. Run `npm run build` to build the package. The built files are in the `dist/` directory.
4. Run `npm run docs` to build the documentation. The output files are in the `docs/` directory.