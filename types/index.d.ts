/**
 * Main class for solving MiniZinc instances.
 *
 * This API allows you to add `.mzn`, `.dzn`, `.json` and `.mpc` files using
 * the `addFile()` method, and then run MiniZinc on the files using the
 * `solve()` method.
 *
 * Code can also be added programmatically using the `addString()` (and similar)
 * methods.
 *
 * @example
 * ```js
 * const model = new MiniZinc.Model();
 * // Add a file with a given name and string contents
 * model.addFile('test.mzn', 'var 1..3: x; int: y;');
 * // Add model code from a string
 * model.addString('int: z;');
 * // Add data in DZN format
 * model.addDznString('y = 1;');
 * // Add data from a JSON object
 * model.addJSON({z: 2});
 *
 * const solve = model.solve({
 *   options: {
 *     solver: 'gecode',
 *     timeout: 10000,
 *     statistics: true
 *   }
 * });
 *
 * // You can listen for events
 * solve.on('solution', solution => console.log(solution));
 * solve.on('statistics', stats => console.log(stats.statistics));
 *
 * // And/or wait until complete
 * solve.then(result => {
 *   console.log(result.solution);
 *   console.log(result.statistics);
 * });
 * ```
 */
export class Model {
  /**
   * Create a new model.
   *
   * @example
   * ```js
   * const model = new MiniZinc.Model();
   * ```
   */
  constructor();

  /**
   * Create a clone of this model.
   *
   * @example
   * ```js
   * const m1 = new MiniZinc.Model();
   * m1.addFile('test.mzn', `
   *   var 1..3: x;
   *   int: y;
   * `);
   * const m2 = m1.clone();
   * // Both m1 and m2 have test.mzn
   *
   * // Add different data to each model
   * m1.addJson({
   *   y: 1
   * });
   * m2.addJson({
   *   y: 2
   * });
   * ```
   */
  clone(): Model;

  /**
   * Add a snippet of code to the model.
   *
   * Note that each snippet is used as a complete model file.
   *
   * @example
   * ```js
   * model.addString("var 1..3: x;");
   * model.addString("float: y;");
   * ```
   *
   * @param model MiniZinc code as a string
   * @returns The filename of the snippet (may be useful to identify sources of errors)
   */
  addString(model: string): string;
  /**
   * Adds a snippet of data to the model.
   *
   * Note that each snippet is used as a complete data file.
   *
   * @example
   * ```js
   * model.addDznString("x = 1;");
   * ```
   *
   * @param dzn DataZinc input as a string
   * @returns The filename of the snippet (may be useful to identify sources of errors)
   */
  addDznString(dzn: string): string;

  /**
   * Adds data to the model in JSON format.
   *
   * Note that each snippet is used as a complete JSON data file.
   *
   * @example
   * ```js
   * model.addJson({
   *   y: 1.5
   * });
   * ```
   *
   * @param data The data as an object in MiniZinc JSON data input format
   * @returns The filename of the snippet (may be useful to identify sources of errors)
   */
  addJson(data: object): string;

  /**
   * Makes the given string contents available to MiniZinc using the given
   * filename.
   *
   * @example
   * ```js
   * /// Add this file to the MiniZinc command
   * model.addFile("model.mzn", `
   *   include "foo.mzn";
   *   var 1..3: x;
   * `);
   * // Make this file available, but don't add it to the MiniZinc command
   * model.addFile("foo.mzn", "var 1..3: y;", false);
   * ```
   *
   * This method is generally only used from the browser.
   *
   * @param filename The file name to use
   * @param contents The contents of the file
   * @param use Whether to add this file as an argument to the MiniZinc command
   */
  addFile(filename: string, contents: string, use?: boolean): void;
  /**
   * Adds the given file to the model.
   *
   * @example
   * ```js
   * model.addFile("./path/to/model.mzn");
   * ```
   *
   * Only available using the native version of MiniZinc in NodeJS.
   *
   * @param filename The file name to use
   */
  addFile(filename: string): void;

  /**
   * Check for errors in the model using `--model-check-only`.
   *
   * @example
   * ```js
   * const errors = model.check({
   *   options: {
   *     solver: 'gecode'
   *   }
   * });
   * for (const error of errors) {
   *   console.log(error.what, error.message);
   * }
   * ```
   *
   * @param config Configuration options
   * @returns The errors in the model
   */
  check(config: {
    /** Options to pass to MiniZinc in parameter configuration file format */
    options?: ParamConfig;
  }): Promise<ErrorMessage[]>;

  /**
   * Get the model interface using `--model-interface-only`.
   *
   * @example
   * ```js
   * model.interface({
   *   options: {
   *     solver: 'gecode'
   *   }
   * }).then(console.log);
   * ```
   *
   * @param config Configuration options
   * @returns The model interface
   */
  interface(config: {
    /** Options to pass to MiniZinc in parameter configuration file format */
    options?: ParamConfig;
  }): Promise<ModelInterface>;

  /**
   * Compile this model to FlatZinc.
   *
   * @example
   * ```js
   * const compile = model.compile({
   *   options: {
   *     solver: 'gecode',
   *     statistics: true
   *   }
   * });
   *
   * // Print compilation statistics when received
   * compile.on('statistics', e => console.log(e.statistics));
   *
   * // Wait for completion
   * compile.then(console.log);
   * ```
   *
   * @param config Configuration options
   */
  compile(config: {
    /** Options to pass to MiniZinc in parameter configuration file format */
    options?: ParamConfig;
  }): CompilationProgress;

  /**
   * Solve this model and retrieve the result.
   *
   * @example
   * ```js
   * // Begin solving
   * const solve = model.solve({
   *   options: {
   *     solver: 'gecode',
   *     'all-solutions': true
   *   }
   * });
   *
   * // Print each solution as it is produced
   * solve.on('solution', e => console.log(e.output));
   *
   * // Wait for completion
   * solve.then(result => {
   *   console.log(result.status);
   * });
   * ```
   *
   * @param config Configuration options
   */
  solve(config: {
    /** Whether to use `--output-mode json` (`true` by default) */
    jsonOutput?: boolean;
    /** Options to pass to MiniZinc in parameter configuration file format */
    options: ParamConfig;
  }): SolveProgress;
}

/**
 * Initialises MiniZinc.
 *
 * Calling this function is generally optional, but may be required if the
 * library is unable to automatically find the `minizinc-worker.js` script in
 * the browser, or the MiniZinc executable on NodeJS.
 *
 * @example
 * ```js
 * // In the browser
 * MiniZinc.init({ workerURL: 'https://localhost:3000/minizinc-worker.js'} );
 * // In NodeJS
 * MiniZinc.init({ minizinc: '/path/to/minizinc' });
 * ```
 *
 * It may also be useful to call in the browser to get a promise which resolves
 * when the WebAssembly module has been loaded.
 *
 * @example
 * ```js
 * MiniZinc.init().then(() => {
 *   console.log('Ready to start solving');
 * });
 * ```
 *
 * @param config Configuration options for initialising MiniZinc
 */
export function init(
  config?: BrowserInitConfig | NodeInitConfig
): Promise<void>;

/**
 * Configuration options for initialising MiniZinc in the browser
 */
export interface BrowserInitConfig {
  /** URL of the worker script */
  workerURL?: string | URL;
  /** URL of the minizinc.wasm file */
  wasmURL?: string | URL;
  /** URL of the minizinc.data file */
  dataURL?: string | URL;
  /** Size of web worker pool */
  numWorkers?: number;
}

/**
 * Configuration options for initialising MiniZinc in NodeJS
 */
export interface NodeInitConfig {
  /** Name of, or path to the minizinc executable */
  minizinc?: string;
  /** Paths to search for the MiniZinc executable in */
  minizincPaths?: string[];
}

/**
 * Get the version of MiniZinc as returned by `minizinc --version`.
 */
export function version(): Promise<string>;

/**
 * Get the list of solver configurations available using `minizinc --solvers-json`.
 */
export function solvers(): Promise<object[]>;

/** Terminate any running MiniZinc processes and cleanup. */
export function shutdown(): void;

/**
 * Options configuration in parameter configuration file ([`.mpc`](https://minizinc.dev/doc-latest/en/command_line.html#ch-param-files))
 * format.
 *
 * @example
 * ```js
 * model.solve({
 *   options: {
 *     solver: 'gecode', // Maps to --solver gecode
 *     'all-solutions': true, // Maps to --all-solutions
 *     'output-objective': true, // maps to --output-objective
 *   }
 * });
 * ```
 */
export interface ParamConfig {
  /** Solver tag to use. */
  solver?: string;
  /** MiniZinc command line options.
   *
   * The leading `--` can be omitted, and if the value is `true` it is treated
   * as a flag).
   */
  [arg: string]: any;
}

/**
 * An error message from MiniZinc.
 *
 * @category Events
 */
export interface ErrorMessage {
  /** Message type */
  type: "error";
  /** The kind of error which occurred */
  what: string;
  /** The error message */
  message: string;
  /** The file location if there is one */
  location?: Location;
  /** The stack trace is there is one */
  stack?: StackItem[];
  /** Other error-specific data */
  [key: string]: any;
}

/**
 * A warning message from MiniZinc.
 *
 * @category Events
 */
export interface WarningMessage {
  /** Message type  */
  type: "warning";
  /** The kind of warning which occurred */
  what: string;
  /** The error message */
  message: string;
  /** The file location if there is one */
  location?: Location;
  /** The stack trace is there is one */
  stack?: StackItem[];
  /** Other error-specific data */
  [key: string]: any;
}

/**
 * A location in a file.
 */
export interface Location {
  /** Filename */
  filename: string;
  /** First line (starting from 1) */
  firstLine: number;
  /** First character (starting from 1) */
  firstColumn: number;
  /** Last line (inclusive) */
  lastLine: number;
  /** Last column (inclusive) */
  lastColumn: number;
}

/**
 * A stack trace item.
 */
export interface StackItem {
  /** Location */
  location: Location;
  /** Whether this is a comprehension iteration item */
  isCompIter: boolean;
  /** String description of the stack trace item */
  description: string;
}

/**
 * Model interface output.
 *
 * @category Events
 */
export interface ModelInterface {
  /** Message type */
  type: "interface";
  /** Model input parameters */
  input: { [name: string]: VarType };
  /** Model output variables */
  output: { [name: string]: VarType };
  /** Solve method */
  method: "sat" | "min" | "max";
  /** Whether there is an output item present */
  has_output_item: boolean;
  /** Files included */
  included_files: string[];
  /** Global constraints used */
  globals: string[];
}

/**
 * Type definition of a variable/parameter.
 */
export interface VarType {
  /** Type of variable */
  type: "int" | "float" | "bool" | "string";
  /** Number of array dimensions if this is an array */
  dim?: number;
  /** Whether or not this variable is a set */
  set?: true;
}

/**
 * Model output mapping section names to their contents.
 *
 * The default mode will populate the `json` key with an object mapping
 * variable names to their values (see the [MiniZinc documentation](https://minizinc.dev/doc-latest/en/spec.html#json-support)
 * for details on the format).
 *
 * Note that sections ending with `_json` will be arrays.
 */
export interface Output {
  /** The string output to the 'default' section (where no section was
   * specified). */
  default?: string;
  /** The DZN output if produced.
   *
   * @example
   * ```js
   * model.solve({
   *   jsonOutput: false,
   *   options: {
   *     solver: 'gecode',
   *    'output-mode': 'dzn'
   *   }
   * });
   * ```
   *
   */
  dzn?: string;
  /** The output of all sections combined */
  raw?: string;
  /** The JSON output if produced */
  json?: { [variable: string]: any };
  /** Output to user-defined sections */
  [section: string]: string | any[] | object | undefined;
}

/**
 * Event emitted when a solution is found by the solver.
 *
 * @category Events
 */
export interface SolutionMessage {
  /** Message type */
  type: "solution";
  /** Time in milliseconds (if run with `output-time: true`) */
  time?: number;
  /** Mapping between output section name and contents */
  output: Output;
  /** The sections output in order */
  sections: string[];
}

/**
 * Event emitted when a solution checker has been run.
 *
 * @category Events
 */
export interface CheckerMessage {
  /** Message type */
  type: "checker";
  /** Time in milliseconds (if run with `output-time: true`) */
  time?: number;
  /** Mapping between output section name and contents */
  output: Output;
  /** The sections output in order */
  sections: string[];
}

/**
 * Solve status.
 */
export type Status =
  /** All solutions found for a satisfaction problem */
  | "ALL_SOLUTIONS"
  /** Optimal solution found for an optimisation problem */
  | "OPTIMAL_SOLUTION"
  /** Problem is unsatisfiable */
  | "UNSATISFIABLE"
  /** Problem is unbounded */
  | "UNBOUNDED"
  /** Problem is unsatisfiable or unbounded */
  | "UNSAT_OR_UNBOUNDED"
  /** Problem is satisfied */
  | "SATISFIED"
  /** Status is unknown */
  | "UNKNOWN"
  /** An error occurred */
  | "ERROR";

/**
 * Event emitted when the final status is emitted by the solver.
 *
 * Note that this event may not be emitted at all.
 *
 * @category Events
 */
export interface StatusMessage {
  /** Message type */
  type: "status";
  /** Status */
  status: Status;
  /** Time in milliseconds (if run with `output-time: true`) */
  time?: number;
}

/**
 * Event emitted when statistics are received from the compiler or the solver.
 *
 * @category Events
 */
export interface StatisticsMessage {
  /** Message type */
  type: "statistics";
  /** Mapping between statistic name and value */
  statistics: { [key: string]: any };
}

/**
 * Event emitted when a timestamp message is received independently of a solution
 * or status.
 *
 * @category Events
 */
export interface TimestampMessage {
  /** Message type */
  type: "time";
  /** Time in milliseconds */
  time: number;
}

/**
 * Event emitted when MiniZinc encounters a call to `trace()`.
 *
 * @category Events
 */
export interface TraceMessage {
  /** Message type */
  type: "trace";
  /** Output section */
  section: string;
  /** Trace message (usually a string, but may be an array if the section ends
   * with `_json`). */
  message: string | any[];
}

/** Event emitted when MiniZinc exits.
 *
 * If solving/compilation is cancelled with the `cancel()` method, then this
 * event is still emitted, but with a `null` value for the `code`.
 *
 * @category Events
 */
export interface ExitMessage {
  /** Message type */
  type: "exit";
  /** Exit code, or null if the process was interrupted */
  code: number | null;
}

/**
 * Thenable controller for a compilation request.
 *
 * Used to listen to events during compilation, and can be awaited to retrieve
 * the compiled FlatZinc.
 */
export interface CompilationProgress extends PromiseLike<string> {
  /**
   * Return whether or not compilation is still in progress.
   *
   * @example
   * ```js
   * const compile = model.compile({
   *   solver: 'gecode'
   * });
   * setInterval(() => {
   *   if (compile.isRunning()) {
   *     console.log('Still running');
   *   }
   * }, 1000)
   * ```
   */
  isRunning(): boolean;

  /** Cancel compilation.
   *
   * @example
   * ```js
   * const compile = model.compile({
   *   solver: 'gecode'
   * });
   * setTimeout(() => {
   *   if (compile.isRunning()) {
   *     compile.cancel();
   *   }
   * }, 10000);
   * ```
   */
  cancel(): void;

  /** Listen for an event.
   *
   * @example
   * ```js
   * const compile = model.compile({
   *   solver: 'gecode',
   *   statistics: true
   * });
   * solve.on('statistics', e => {
   *   console.log(e.statistics);
   * });
   * ```
   */
  on(event: "statistics", callback: (e: StatisticsMessage) => void): void;
  on(event: "trace", callback: (e: TraceMessage) => void): void;
  on(event: "error", callback: (e: ErrorMessage) => void): void;
  on(event: "warning", callback: (e: WarningMessage) => void): void;
  on(event: "exit", callback: (e: ExitMessage) => void): void;
  on(event: string, callback: (e: object) => void): void;

  /** Stop listening for an event.
   *
   * @example
   * ```js
   * const compile = model.compile({
   *   solver: 'gecode',
   *   statistics: true
   * });
   * const onStat = e => {
   *   console.log(e.output);
   * };
   * // Start listening
   * compile.on('statistics', onStat);
   * setTimeout(() => {
   *   // Stop listening
   *   compile.off('statistics', onStat);
   * }, 1000);
   * ```
   */
  off<T>(event: string, callback: (e: T) => void): void;
}

/**
 * Thenable controller for a solve request.
 *
 * Used to listen to events during solving, and can be awaited to retrieve
 * the final solution/statistics/status.
 */
export interface SolveProgress extends PromiseLike<SolveResult> {
  /**
   * Return whether or not solving is still in progress.
   *
   * @example
   * ```js
   * const solve = model.solve({
   *   solver: 'gecode'
   * });
   * setInterval(() => {
   *   if (solve.isRunning()) {
   *     console.log('Still running');
   *   }
   * }, 1000)
   * ```
   */
  isRunning(): boolean;

  /** Cancel solving.
   *
   * @example
   * ```js
   * const solve = model.solve({
   *   solver: 'gecode'
   * });
   * setTimeout(() => {
   *   if (solve.isRunning()) {
   *     solve.cancel();
   *   }
   * }, 10000);
   * ```
   */
  cancel(): void;

  /** Listen for an event.
   *
   * @example
   * ```js
   * const solve = model.solve({
   *   solver: 'gecode'
   * });
   * solve.on('solution', e => {
   *   console.log(e.output);
   * });
   * ```
   */
  on(event: "solution", callback: (e: SolutionMessage) => void): void;
  on(event: "checker", callback: (e: CheckerMessage) => void): void;
  on(event: "status", callback: (e: StatusMessage) => void): void;
  on(event: "statistics", callback: (e: StatisticsMessage) => void): void;
  on(event: "timestamp", callback: (e: TimestampMessage) => void): void;
  on(event: "trace", callback: (e: TraceMessage) => void): void;
  on(event: "error", callback: (e: ErrorMessage) => void): void;
  on(event: "warning", callback: (e: WarningMessage) => void): void;
  on(event: "exit", callback: (e: ExitMessage) => void): void;
  on(event: string, callback: (e: object) => void): void;

  /** Stop listening for an event.
   *
   * @example
   * ```js
   * const solve = model.solve({
   *   solver: 'gecode'
   * });
   * const onSolution = e => {
   *   console.log(e.output);
   * };
   * // Start listening
   * solve.on('solution', onSolution);
   * setTimeout(() => {
   *   // Stop listening
   *   solve.off('solution', onSolution);
   * }, 1000);
   * ```
   */
  off<T>(event: string, callback: (e: T) => void): void;
}

/**
 * Result of solving the model.
 */
export interface SolveResult {
  /** Solve status. */
  status: Status;
  /** The final solution if any was found. */
  solution: SolutionMessage | null;
  /** A combined statistics object with the latest value for each key if
   * statistics output was enabled during solving.
   */
  statistics: { [key: string]: any };
}
