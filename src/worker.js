// Web worker code for the browser

import MINIZINC from "minizinc-bin";

let initMiniZinc = null;

addEventListener("message", async (e) => {
  try {
    if (initMiniZinc) {
      const Module = await initMiniZinc;
      if (e.data.readStdlibFiles) {
        const files = {};
        const prefix = "file:///usr/share/minizinc/";
        for (const key of e.data.readStdlibFiles) {
          const resolved = new URL(prefix + key).href;
          if (resolved.indexOf(prefix) !== 0) {
            // Ensure path is a valid relative path
            console.error(`Unsupported file path ${key}`);
            postMessage({
              type: "error",
              message: `Unsupported file path ${key}`,
            });
            return;
          }
          const path =
            "/usr/share/minizinc/" + resolved.substring(prefix.length);
          if (Module.FS.analyzePath(path).exists) {
            files[key] = Module.FS.readFile(path, {
              encoding: "utf8",
            });
          } else {
            files[key] = null;
          }
        }
        postMessage({
          type: "readStdlibFiles",
          files,
        });
        return;
      }
      Module.stdoutBuffer = [];
      Module.stderrBuffer = [];
      Module.jsonStream = !!e.data.jsonStream;
      Module.FS.mount(Module.FS.filesystems.MEMFS, null, "/minizinc");
      if (e.data.files) {
        const prefix = "file:///minizinc/";
        for (const key in e.data.files) {
          const resolved = new URL(prefix + key).href;
          if (resolved.indexOf(prefix) !== 0) {
            // Ensure path is a valid relative path
            throw new Error(`Unsupported file path ${key}`);
          }
          const dest = "/minizinc/" + resolved.substring(prefix.length);
          for (let i = 0; i != -1; i = dest.indexOf("/", i + 1)) {
            // Create parent paths
            const path = dest.substring(0, i);
            if (!Module.FS.analyzePath(path).exists) {
              Module.FS.mkdir(path);
            }
          }
          // Write file
          Module.FS.writeFile(dest, e.data.files[key]);
        }
      }
      // Always include --json-stream
      const args = Module.jsonStream
        ? ["--json-stream", ...e.data.args]
        : e.data.args;
      const oldCwd = Module.FS.cwd();
      Module.FS.chdir("/minizinc");
      try {
        const code = Module.callMain(args);
        // Add exit message so the controller can tell that we're done
        const exitMessage = { type: "exit", code };
        if (Module.stdoutBuffer.length > 0) {
          const decoder = new TextDecoder("utf-8");
          exitMessage.stdout = decoder.decode(
            new Uint8Array(Module.stdoutBuffer)
          );
        }
        if (Module.stderrBuffer.length > 0) {
          const decoder = new TextDecoder("utf-8");
          exitMessage.stderr = decoder.decode(
            new Uint8Array(Module.stderrBuffer)
          );
        }
        if (e.data.outputFiles) {
          exitMessage.outputFiles = {};
          const prefix = "file:///minizinc/";
          for (const key of e.data.outputFiles) {
            const resolved = new URL(prefix + key).href;
            if (resolved.indexOf(prefix) !== 0) {
              // Ensure path is a valid relative path
              throw new Error(`Unsupported file path ${key}`);
            }
            const path = "/minizinc/" + resolved.substring(prefix.length);
            if (Module.FS.analyzePath(path).exists) {
              exitMessage.outputFiles[key] = Module.FS.readFile(path, {
                encoding: "utf8",
              });
            } else {
              exitMessage.outputFiles[key] = null;
            }
          }
        }
        postMessage(exitMessage);
      } catch (e) {
        console.error(e);
        postMessage({
          type: "exit",
          code: -1,
          error: e.message,
        });
      }
      Module.FS.chdir(oldCwd);
      Module.FS.unmount("/minizinc");
    } else {
      initMiniZinc = MINIZINC({
        locateFile(path, prefix) {
          if (path === "minizinc.wasm") {
            return e.data.wasmURL;
          }
          if (path === "minizinc.data") {
            return e.data.dataURL;
          }
          return prefix + path;
        },
        preRun: [
          (Module) => {
            const stdout = (code) => {
              if (code === 0x0) {
                return;
              }
              Module.stdoutBuffer.push(code);
              if (Module.jsonStream && code === 0x0a) {
                const decoder = new TextDecoder("utf-8");
                const line = decoder.decode(
                  new Uint8Array(Module.stdoutBuffer)
                );
                try {
                  // Send the JSON stream message
                  const obj = JSON.parse(line);
                  if (
                    "location" in obj &&
                    "filename" in obj.location &&
                    obj.location.filename.indexOf("/minizinc/") === 0
                  ) {
                    // Strip prefix from filename
                    obj.location.filename = obj.location.filename.substring(10);
                  }
                  if ("stack" in obj && Array.isArray(obj.stack)) {
                    for (const s of obj.stack) {
                      if (
                        "location" in s &&
                        "filename" in s.location &&
                        s.location.filename.indexOf("/minizinc/") === 0
                      ) {
                        // Strip prefix from filename
                        s.location.filename = s.location.filename.substring(10);
                      }
                    }
                  }
                  postMessage(obj);
                } catch (e) {
                  // Fall back to creating a stdout message
                  postMessage({
                    type: "stdout",
                    value: line,
                  });
                }
                Module.stdoutBuffer = [];
              }
            };
            const stderr = (code) => {
              if (code === 0x0) {
                return;
              }
              Module.stderrBuffer.push(code);
              if (Module.jsonStream && code === 0x0a) {
                // Send as a stderr message
                const decoder = new TextDecoder("utf-8");
                const line = decoder.decode(
                  new Uint8Array(Module.stderrBuffer)
                );
                postMessage({
                  type: "stderr",
                  value: line,
                });
                Module.stderrBuffer = [];
              }
            };
            Module.FS.init(null, stdout, stderr);
            Module.FS.mkdir("/minizinc");

            // Make gecode_presolver available as gecode solver
            Module.FS.mkdir("/home/web_user/.minizinc");
            Module.FS.writeFile(
              "/home/web_user/.minizinc/Preferences.json",
              JSON.stringify({
                solverDefaults: [
                  [
                    "org.minizinc.gecode_presolver",
                    "--backend-flags",
                    "--allow-unbounded-vars",
                  ],
                ],
                tagDefaults: [["", "org.minizinc.gecode_presolver"]],
              })
            );
          },
        ],
        noInitialRun: true,
        noExitRuntime: true,
      });
    }

    await initMiniZinc;
    postMessage({ type: "ready" });
  } catch (e) {
    console.error(e);
  }
});
