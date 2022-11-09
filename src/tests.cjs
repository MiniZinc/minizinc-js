// Tests for common API

module.exports.commonTests = (MiniZinc) => {
  test("Version output", async () => {
    const version = await MiniZinc.version();
    expect(version).toMatch(/version (\d)+\.(\d)+\.(\d)+/);
  });

  test("Solvers output", async () => {
    const solvers = await MiniZinc.solvers();
    expect(Array.isArray(solvers)).toBe(true);
  });

  test("Basic solve", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x;");
    const result = await model.solve();
    const x = result.solution.output.json.x;
    expect(x).toBeGreaterThanOrEqual(1);
    expect(x).toBeLessThanOrEqual(3);
  });

  test("DZN output", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x;");
    const result = await model.solve({
      jsonOutput: false,
      options: {
        "output-mode": "dzn",
      },
    });
    expect(result.solution.output.dzn).toMatch(/x = [1-3];\n/);
  });

  test("Solve with DZN data", async () => {
    const model = new MiniZinc.Model();
    model.addString(`
      var 1..3: x;
      int: y;
      constraint x > y;
    `);
    model.addDznString("y = 2;");
    const result = await model.solve();
    const x = result.solution.output.json.x;
    expect(x).toBe(3);
  });

  test("Solve with JSON data", async () => {
    const model = new MiniZinc.Model();
    model.addString(`
      var 1..3: x;
      int: y;
      constraint x > y;
    `);
    model.addJson({
      y: 2,
    });
    const result = await model.solve();
    const x = result.solution.output.json.x;
    expect(x).toBe(3);
  });

  test("Events", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x;");
    const solve = model.solve({
      options: {
        "all-solutions": true,
        statistics: true,
      },
    });
    const values = [];
    solve.on("solution", (e) => values.push(e.output.json.x));
    solve.on("status", (e) => expect(e.status).toBe("ALL_SOLUTIONS"));
    const result = await solve;
    expect(result.statistics.nSolutions).toBe(3);
    expect(values).toContain(1);
    expect(values).toContain(2);
    expect(values).toContain(3);
    expect(values.length).toBe(3);
  });

  test("Basic compile", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x;");
    const fzn = await model.compile();
    expect(fzn).toMatch(
      /var\s+1\s*\.\.\s*3\s*:\s*x\s*::\s*output_var\s*;\s*solve\s*satisfy;\s*/
    );
  });

  test("Model check success", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x;");
    const errors = await model.check();
    expect(errors.length).toBe(0);
  });

  test("Model check error", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x; var 1..3: x;");
    const errors = await model.check();
    expect(errors.length).toBe(1);
  });

  test("Model interface", async () => {
    const model = new MiniZinc.Model();
    model.addString("var 1..3: x; int: y;");
    const iface = await model.interface();
    expect(iface.input).toEqual({
      y: { type: "int" },
    });
    expect(iface.output).toEqual({ x: { type: "int" } });
    expect(iface.method).toBe("sat");
  });
};
