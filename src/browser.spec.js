const MiniZinc = require("../dist/test-minizinc.cjs");

// Use web worker library for worker since not available on node
global.Worker = require("web-worker");

const { commonTests } = require("./tests.cjs");

jest.setTimeout(30000);

beforeAll(async () => {
  await MiniZinc.init({ workerURL: "./dist/test-minizinc-worker.cjs" });
});

afterAll(() => {
  MiniZinc.shutdown();
});

test("Virtual filesystem", async () => {
  const model = new MiniZinc.Model();
  model.addFile("test.mzn", 'include "foo.mzn";');
  model.addFile(
    "foo.mzn",
    `var 1..3: x;
    int: y;
    constraint x < y;`,
    false
  );
  model.addFile("data.dzn", "y = 2;");
  const result = await model.solve();
  const x = result.solution.output.json.x;
  expect(x).toBe(1);
});

commonTests(MiniZinc);
