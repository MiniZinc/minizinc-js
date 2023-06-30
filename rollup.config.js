import commonjs from "@rollup/plugin-commonjs";
import copy from "rollup-plugin-copy";
import { terser } from "@el3um4s/rollup-plugin-terser";
import replace from "@rollup/plugin-replace";
import alias from "@rollup/plugin-alias";
import path from "path";
import fs from "fs";

const pkg = JSON.parse(fs.readFileSync('./package.json'));

const testing = process.env.TEST;
const production = !process.env.ROLLUP_WATCH && !testing;
const minizincInstallDir = process.env.MZN_WASM_DIR || ".";

const browser = (output, src) => ({
  input: "src/browser.js",
  output: {
    sourcemap: !production,
    ...output,
  },
  plugins: [
    production && terser(),
    replace({
      URL_BASE: src || "document.currentScript.src",
      PACKAGE_VERSION: JSON.stringify(pkg.version),
      preventAssignment: true,
      ...(testing && {
        _workerUrl: "settings.workerURL",
      }),
    }),
  ],
});

const worker = (output) => ({
  input: "src/worker.js",
  output: {
    sourcemap: !production,
    ...output,
  },
  plugins: [
    alias({
      entries: [
        {
          find: "minizinc-bin",
          replacement: path.join(minizincInstallDir, "/bin/minizinc.js"),
        },
      ],
    }),
    copy({
      targets: [
        {
          src: [
            path
              .join(minizincInstallDir, "/bin/minizinc.data")
              .replace(/\\/g, "/"),
            path
              .join(minizincInstallDir, "/bin/minizinc.wasm")
              .replace(/\\/g, "/"),
          ],
          dest: "dist",
        },
      ],
      verbose: true,
    }),
    commonjs({ ignore: ["fs", "path", "perf_hooks", "ws"] }),
    production && terser(),
  ],
});

const node = (output) => ({
  input: "src/node.js",
  output: {
    sourcemap: !production,
    ...output,
  },
  plugins: [production && terser()],
  external: [
    "node:child_process",
    "node:events",
    "node:readline",
    "node:fs/promises",
    "node:path",
    "node:os",
  ],
});

const configs = testing
  ? [
      // Bundles for running tests
      browser(
        {
          file: "dist/test-minizinc.cjs",
          format: "cjs",
        },
        "`file:///${__dirname}`"
      ),
      worker({
        file: "dist/test-minizinc-worker.cjs",
        format: "cjs",
      }),
      node({
        file: "dist/test-minizinc-node.cjs",
        format: "cjs",
      }),
    ]
  : [
      // Bundles for distribution
      browser({
        name: "MiniZinc",
        file: "dist/minizinc.js",
        format: "iife",
      }),
      browser(
        {
          file: "dist/minizinc.mjs",
          format: "es",
        },
        "import.meta.url"
      ),
      browser({
        file: "dist/minizinc.cjs",
        format: "cjs",
      }),
      worker({
        file: "dist/minizinc-worker.js",
        format: "iife",
      }),
      node({
        file: "dist/minizinc-node.cjs",
        format: "cjs",
      }),
      node({
        file: "dist/minizinc-node.mjs",
        format: "es",
      }),
    ];

export default configs;
