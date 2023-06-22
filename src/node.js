// Controller used in node environments which uses child processes instead of wasm

import child_process from "node:child_process";
import EventEmitter from "node:events";
import rl from "node:readline";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let settings = { minizinc: "minizinc", _executable: "minizinc" };

export async function init(cfg) {
  if (cfg) {
    settings = { ...settings, ...cfg };
  }
  if (!/\\\//.test(settings.minizinc) && settings.minizincPaths) {
    for (const p of minizincPaths) {
      const executable = path.join(p, settings.minizinc);
      try {
        await fs.access(executable);
        settings._executable = executable;
      } catch {}
    }
  }
  settings._executable = settings.minizinc;
}

const childProcesses = new Set();
export function shutdown() {
  for (const proc of childProcesses) {
    proc.kill("SIGKILL");
  }
  childProcesses.clear();
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
    this._addVirtual(filename, model);
    return filename;
  }
  addDznString(dzn) {
    let filename = `_dzn_${this.unnamedCount++}.dzn`;
    while (filename in this.vfs) {
      filename = `_dzn_${this.unnamedCount++}.dzn`;
    }
    this._addVirtual(filename, dzn);
    return filename;
  }
  addJson(data) {
    let filename = `_json_${this.unnamedCount++}.json`;
    while (filename in this.vfs) {
      filename = `_json_${this.unnamedCount++}.json`;
    }
    this._addVirtual(filename, JSON.stringify(data));
    return filename;
  }
  _add_toRun(filename, use) {
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
  _addVirtual(filename, contents, use = true) {
    this.vfs[filename] = contents;
    this._add_toRun(filename, use);
  }
  addFile(filename, contents = null, use = true) {
    if (typeof contents === "string") {
      this._addVirtual(filename, contents, use);
    } else {
      this._add_toRun(filename.use);
    }
  }
  _run(args, options, outputFiles) {
    const emitter = new EventEmitter();
    let proc = null;
    emitter.on("sigint", () => {
      if (proc) {
        proc.kill("SIGINT");
      } else {
        proc = false;
      }
    });
    (async () => {
      const preArgs = ["--json-stream"];
      const tempdir = await fs.mkdtemp(path.join(os.tmpdir(), "mzn"));
      if (options) {
        let mpcFile = `_mzn_${this.unnamedCount++}.mpc`;
        while (mpcFile in this.vfs) {
          mpcFile = `_mzn_${this.unnamedCount++}.mpc`;
        }
        mpcFile = path.join(tempdir, mpcFile);
        await fs.writeFile(mpcFile, JSON.stringify(options));
        preArgs.push(mpcFile);
      }
      for (const key in this.vfs) {
        await fs.writeFile(path.join(tempdir, key), this.vfs[key]);
      }
      if (proc === false) {
        emitter.emit("exit", { code: 0 });
        return;
      }
      proc = child_process.spawn(settings._executable, [
        ...preArgs,
        ...args.map((x) =>
          outputFiles && outputFiles.indexOf(x) !== -1
            ? path.join(tempdir, x)
            : x
        ),
        ...this._toRun.map((x) => {
          if (x in this.vfs) {
            return path.join(tempdir, x);
          } else {
            return x;
          }
        }),
      ]);
      childProcesses.add(proc);
      const stdout = rl.createInterface(proc.stdout);
      stdout.on("line", async (line) => {
        try {
          const obj = JSON.parse(line);
          if (
            "location" in obj &&
            "filename" in obj.location &&
            obj.location.filename.indexOf(tempdir) === 0
          ) {
            // Strip prefix from filename
            obj.location.filename = obj.location.filename.substring(
              tempdir.length
            );
          }
          if ("stack" in obj && Array.isArray(obj.stack)) {
            for (const s of obj.stack) {
              if (
                "location" in s &&
                "filename" in s.location &&
                s.location.filename.indexOf(tempdir) === 0
              ) {
                // Strip prefix from filename
                s.location.filename = s.location.filename.substring(
                  tempdir.length
                );
              }
            }
          }
          emitter.emit(obj.type, obj);
        } catch (e) {
          emitter.emit("stdout", { type: "stdout", value: line });
        }
      });
      const stderr = rl.createInterface(proc.stderr);
      stderr.on("line", async (line) => {
        emitter.emit("stderr", line);
      });
      proc.on("exit", async (c, signal) => {
        childProcesses.delete(proc);
        const exitMessage = {
          type: "exit",
          code: signal === "SIGINT" ? null : c,
        };
        if (outputFiles) {
          exitMessage.outputFiles = {};
          for (const key of outputFiles) {
            try {
              exitMessage.outputFiles[key] = await fs.readFile(key, {
                encoding: "utf8",
              });
            } catch (e) {
              try {
                exitMessage.outputFiles[key] = await fs.readFile(
                  path.join(tempdir, key),
                  { encoding: "utf8" }
                );
              } catch (e) {
                exitMessage.outputFiles[key] = null;
              }
            }
          }
        }
        emitter.emit("exit", exitMessage);
        fs.rm(tempdir, { recursive: true, force: true });
      });
    })();
    return emitter;
  }
  check(cfg) {
    const config = { ...cfg };
    const proc = this._run(["--model-check-only"], config.options);
    const errors = [];
    proc.on("error", (e) => errors.push(e));
    return new Promise((resolve, _reject) => {
      proc.on("exit", (e) => resolve(errors));
    });
  }
  interface(cfg) {
    const config = { ...cfg };
    const proc = this._run(["-c", "--model-interface-only"], config.options);
    const errors = [];
    let iface = null;
    proc.on("error", (e) => errors.push(e));
    proc.on("interface", (e) => (iface = e));
    return new Promise((resolve, reject) => {
      proc.on("exit", (e) => {
        if (e.code === 0) {
          resolve(iface);
        } else {
          reject(errors);
        }
      });
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
    let running = true;
    let error = null;
    const proc = this._run(args, config.options, [out]);
    proc.on("exit", () => (running = false));
    proc.on("error", (e) => {
      if (!error) error = e;
    });
    return {
      isRunning() {
        return running;
      },
      cancel() {
        proc.emit("sigint");
      },
      on: (event, listener) => proc.on(event, listener),
      off: (event, listener) => proc.off(event, listener),
      then(resolve, reject) {
        proc.on("exit", (e) => {
          if (e.code === 0) {
            resolve(e.outputFiles[out]);
          } else if (reject) {
            reject({ ...e, error });
          } else {
            throw e;
          }
        });
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
    let running = true;
    let error = null;
    const proc = this._run(args, config.options);
    proc.on("exit", () => (running = false));
    let solution = null;
    let statistics = {};
    let status = "UNKNOWN";
    proc.on("statistics", (e) => {
      statistics = {
        ...statistics,
        ...e.statistics,
      };
    });
    proc.on("solution", (e) => {
      solution = e;
      status = "SATISFIED";
    });
    proc.on("status", (e) => {
      status = e.status;
    });
    proc.on("error", (e) => {
      if (!error) error = e;
    });
    return {
      isRunning() {
        return running;
      },
      cancel() {
        proc.emit("sigint");
      },
      on: (event, listener) => proc.on(event, listener),
      off: (event, listener) => proc.off(event, listener),
      then(resolve, reject) {
        proc.on("exit", (e) => {
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
        });
      },
    };
  }
}

export function version() {
  return new Promise((resolve, reject) => {
    let proc = null;
    proc = child_process.execFile(
      settings._executable,
      ["--version"],
      (error, stdout, stderr) => {
        childProcesses.delete(proc);
        if (error) {
          reject(error);
        }
        resolve(stdout);
      }
    );
    childProcesses.add(proc);
  });
}

export function solvers() {
  return new Promise((resolve, reject) => {
    let proc = null;
    proc = child_process.execFile(
      settings._executable,
      ["--solvers-json"],
      (error, stdout, stderr) => {
        childProcesses.delete(proc);
        if (error) {
          reject(error);
        }
        resolve(JSON.parse(stdout));
      }
    );
    childProcesses.add(proc);
  });
}

export function readStdlibFileContents(files) {
  const keys = Array.isArray(files) ? files : [files];
  return new Promise((resolve, reject) => {
    let proc = null;
    proc = child_process.execFile(
      settings._executable,
      ["--config-dirs"],
      async (error, stdout, stderr) => {
        childProcesses.delete(proc);
        if (error) {
          reject(error);
        }
        const mznStdlibDir = JSON.parse(stdout).mznStdlibDir;
        const result = {};
        for (const key of keys) {
          const p = path.join(mznStdlibDir, key);
          const rel = path.relative(mznStdlibDir, p);
          if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
            reject(`Unsupported file path ${key}`);
          }
          try {
            result[key] = await fs.readFile(p, {
              encoding: "utf8",
            });
          } catch (e) {
            result[key] = null;
          }
        }
        if (Array.isArray(files)) {
          resolve(result);
        } else {
          resolve(result[files]);
        }
      }
    );
    childProcesses.add(proc);
  });
}
