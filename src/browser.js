// Controller in charge of web worker pool in the browser

const cacheBuster = encodeURIComponent(PACKAGE_VERSION);
let settings = {
  workerURL: new URL(`./minizinc-worker.js?version=${cacheBuster}`, URL_BASE),
  numWorkers: 2,
};
const workers = [];
let workerObjectURL;

function newWorker() {
  if (!workerObjectURL) {
    const importer = `importScripts(${JSON.stringify(settings.workerURL)});`;
    workerObjectURL = URL.createObjectURL(
      new Blob([importer], { type: "text/javascript" })
    );
  }
  const _workerUrl = workerObjectURL;
  const worker = new Worker(_workerUrl);
  worker.postMessage({
    wasmURL: settings.wasmURL
      ? settings.wasmURL.toString()
      : new URL(
          `./minizinc.wasm?version=${cacheBuster}`,
          settings.workerURL
        ).toString(),
    dataURL: settings.dataURL
      ? settings.dataURL.toString()
      : new URL(
          `./minizinc.data?version=${cacheBuster}`,
          settings.workerURL
        ).toString(),
  });
  workers.push({ worker, runCount: 0 });
}

function fillWorkerPool() {
  while (workers.length < settings.numWorkers) {
    newWorker();
  }
}

export async function init(cfg) {
  if (cfg) {
    settings = { ...settings, ...cfg };
  }
  if (workers.length > 0) {
    throw new Error(
      "MiniZinc.init() called after library already used/initialised"
    );
  }
  fillWorkerPool();
  await Promise.race(
    workers.map(
      (worker) =>
        new Promise((resolve) => {
          worker.worker.addEventListener(
            "message",
            (e) => {
              if (e.data.type === "ready") {
                resolve();
              }
            },
            { once: true }
          );
        })
    )
  );
}

export function shutdown() {
  for (const worker of workers) {
    worker.worker.terminate();
  }
  workers.splice(0);
  URL.revokeObjectURL(workerObjectURL);
  workerObjectURL = null;
}

export class Model {
  constructor() {
    this.vfs = {};
    this._toRun = [];
    this.unnamedCount = 0;
  }
  clone() {
    const clone = new Model();
    clone.vfs = { ...this.vfs };
    clone._toRun = [...this.toRun];
    clone.unnamedCount = this.unnamedCount;
    return clone;
  }
  addString(model) {
    let filename = `_mzn_${this.unnamedCount++}.mzn`;
    while (filename in this.vfs) {
      filename = `_mzn_${this.unnamedCount++}.mzn`;
    }
    this.addFile(filename, model);
    return filename;
  }
  addDznString(dzn) {
    let filename = `_dzn_${this.unnamedCount++}.dzn`;
    while (filename in this.vfs) {
      filename = `_dzn_${this.unnamedCount++}.dzn`;
    }
    this.addFile(filename, dzn);
    return filename;
  }
  addJson(data) {
    let filename = `_json_${this.unnamedCount++}.json`;
    while (filename in this.vfs) {
      filename = `_json_${this.unnamedCount++}.json`;
    }
    this.addFile(filename, JSON.stringify(data));
    return filename;
  }
  addFile(filename, contents, use = true) {
    if (typeof contents !== "string") {
      if (filename in this.vfs) {
        this._addToRun(filename, use);
        return;
      }
      throw new Error("Missing file contents argument");
    }
    this.vfs[filename] = contents;
    this._addToRun(filename, use);
  }
  _addToRun(filename, use) {
    if (
      use &&
      (filename.endsWith(".mzn") ||
        filename.endsWith(".mzc") ||
        filename.endsWith(".dzn") ||
        filename.endsWith(".json") ||
        filename.endsWith(".mpc") ||
        filename.endsWith(".fzn")) &&
      this._toRun.indexOf(filename) === -1
    ) {
      this._toRun.push(filename);
    }
  }
  _run(args, options, outputFiles = null) {
    fillWorkerPool();
    const preArgs = [];
    let files = this.vfs;
    if (options) {
      let mpcFile = `_mzn_${this.unnamedCount++}.mpc`;
      while (mpcFile in this.vfs) {
        mpcFile = `_mzn_${this.unnamedCount++}.mpc`;
      }
      files = { ...this.vfs, [mpcFile]: JSON.stringify(options) };
      preArgs.push(mpcFile);
    }
    let { worker, runCount } = workers.pop();
    worker.postMessage({
      jsonStream: true,
      files,
      args: [...preArgs, ...args, ...this._toRun],
      outputFiles,
    });
    return { worker, runCount: runCount + 1 };
  }
  check(cfg) {
    return new Promise((resolve, _reject) => {
      const config = { ...cfg };
      const { worker, runCount } = this._run(
        ["--model-check-only"],
        config.options
      );
      const errors = [];
      worker.onmessage = (e) => {
        switch (e.data.type) {
          case "error":
            errors.push(e.data);
            break;
          case "exit":
            if (runCount < 10) {
              workers.push({
                worker,
                runCount,
              });
            } else {
              worker.terminate();
              newWorker();
            }
            resolve(errors);
            break;
        }
      };
    });
  }
  interface(cfg) {
    return new Promise((resolve, reject) => {
      const config = { ...cfg };
      const { worker, runCount } = this._run(
        ["-c", "--model-interface-only"],
        config.options
      );
      const errors = [];
      let iface = null;
      worker.onmessage = (e) => {
        switch (e.data.type) {
          case "error":
            errors.push(e.data);
            break;
          case "interface":
            iface = e.data;
            break;
          case "exit":
            if (runCount < 10) {
              workers.push({
                worker,
                runCount,
              });
            } else {
              worker.terminate();
              newWorker();
            }
            if (e.data.code === 0) {
              resolve(iface);
            } else {
              reject(errors);
            }
            break;
        }
      };
    });
  }
  compile(cfg) {
    const config = { ...cfg };
    let i = 0;
    let out = `_fzn_${i++}.fzn`;
    while (out in this.vfs) {
      out = `_fzn_${i++}.fzn`;
    }
    const args = ["-c", "--fzn", out];
    const { worker } = this._run(args, config.options, [out]);
    // Don't reuse this worker, always create add a new one to the pool
    newWorker();
    let callbacks = {};
    let exited = false;
    let error = null;
    worker.onmessage = (e) => {
      if (callbacks[e.data.type]) {
        for (const f of callbacks[e.data.type]) {
          f(e.data);
        }
      }
      switch (e.data.type) {
        case "exit":
          worker.terminate();
          exited = true;
          callbacks = {};
          break;
        case "error":
          if (!error) error = e.data;
          break;
      }
    };
    return {
      isRunning() {
        return !exited;
      },
      cancel() {
        if (!exited) {
          exited = true;
          worker.terminate();
          if (callbacks["exit"]) {
            for (const f of callbacks["exit"]) {
              f({ type: "exit", code: null });
            }
          }
          callbacks = {};
        }
      },
      on(event, callback) {
        if (callbacks[event]) {
          callbacks[event].add(callback);
        } else {
          callbacks[event] = new Set([callback]);
        }
      },
      off(event, callback) {
        if (callbacks[event]) {
          callbacks[event].delete(callback);
        }
      },
      then(resolve, reject) {
        const onExit = (e) => {
          if (e.code === 0) {
            resolve(e.outputFiles[out]);
          } else if (reject) {
            reject({ ...e, error });
          } else {
            throw e;
          }
        };
        if (callbacks.exit) {
          callbacks.exit.add(onExit);
        } else {
          callbacks.exit = new Set([onExit]);
        }
      },
    };
  }
  solve(cfg) {
    const config = { jsonOutput: true, ...cfg };
    const args = ["-i"]; // Always use intermediate solutions
    if (config.jsonOutput) {
      args.push("--output-mode");
      args.push("json");
    }
    const { worker } = this._run(args, config.options);
    // Don't reuse this worker, always create add a new one to the pool
    newWorker();
    let error = null;
    let callbacks = {};
    let exited = false;
    let solution = null;
    let statistics = {};
    let status = "UNKNOWN";
    worker.onmessage = (e) => {
      if (callbacks[e.data.type]) {
        for (const f of callbacks[e.data.type]) {
          f(e.data);
        }
      }
      switch (e.data.type) {
        case "exit":
          worker.terminate();
          exited = true;
          callbacks = {};
          break;
        case "error":
          if (!error) error = e.data;
          break;
        case "statistics":
          statistics = {
            ...statistics,
            ...e.data.statistics,
          };
          break;
        case "solution":
          solution = e.data;
          status = "SATISFIED";
          break;
        case "status":
          status = e.data.status;
          break;
      }
    };
    return {
      isRunning() {
        return !exited;
      },
      cancel() {
        if (!exited) {
          exited = true;
          worker.terminate();
          if (callbacks["exit"]) {
            for (const f of callbacks["exit"]) {
              f({ type: "exit", code: null });
            }
          }
          callbacks = {};
        }
      },
      on(event, callback) {
        if (callbacks[event]) {
          callbacks[event].add(callback);
        } else {
          callbacks[event] = new Set([callback]);
        }
      },
      off(event, callback) {
        if (callbacks[event]) {
          callbacks[event].delete(callback);
        }
      },
      then(resolve, reject) {
        const onExit = (e) => {
          if (e.code === 0) {
            resolve({
              status,
              solution,
              statistics,
            });
          } else if (reject) {
            reject({ ...e, error });
          } else {
            throw e;
          }
        };
        if (callbacks.exit) {
          callbacks.exit.add(onExit);
        } else {
          callbacks.exit = new Set([onExit]);
        }
      },
    };
  }
}

export function version() {
  return new Promise((resolve, reject) => {
    fillWorkerPool();
    let { worker, runCount } = workers.pop();
    worker.postMessage({
      jsonStream: false,
      args: ["--version"],
    });
    worker.onmessage = (e) => {
      if (e.data.type === "exit") {
        if (runCount < 10) {
          workers.push({
            worker,
            runCount: runCount + 1,
          });
        } else {
          worker.terminate();
          newWorker();
        }
        if (e.data.code === 0) {
          resolve(e.data.stdout);
        } else {
          reject(e.data);
        }
      }
    };
  });
}

export function solvers() {
  return new Promise((resolve, reject) => {
    fillWorkerPool();
    let { worker, runCount } = workers.pop();
    worker.postMessage({
      jsonStream: false,
      args: ["--solvers-json"],
    });
    worker.onmessage = (e) => {
      if (e.data.type === "exit") {
        if (runCount < 10) {
          workers.push({
            worker,
            runCount: runCount + 1,
          });
        } else {
          worker.terminate();
          newWorker();
        }
        if (e.data.code === 0) {
          resolve(JSON.parse(e.data.stdout));
        } else {
          reject(e.data);
        }
      }
    };
  });
}

export function readStdlibFileContents(files) {
  const keys = Array.isArray(files) ? files : [files];
  return new Promise((resolve, reject) => {
    fillWorkerPool();
    let { worker, runCount } = workers.pop();
    worker.postMessage({
      readStdlibFiles: keys,
    });
    worker.onmessage = (e) => {
      if (e.data.type === "readStdlibFiles") {
        if (runCount < 10) {
          workers.push({
            worker,
            runCount: runCount + 1,
          });
        } else {
          worker.terminate();
          newWorker();
        }
        if (Array.isArray(files)) {
          resolve(e.data.files);
        } else {
          resolve(e.data.files[files]);
        }
      } else if (e.data.type === "error") {
        worker.terminate();
        newWorker();
        reject(e.data.message);
      }
    };
  });
}
