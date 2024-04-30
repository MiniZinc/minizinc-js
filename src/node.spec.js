const path = require('path');

const MiniZinc = require("../dist/test-minizinc-node.cjs");

const { commonTests } = require("./tests.cjs");

beforeAll(async () => {
  await MiniZinc.init({
    minizinc: process.env.MZN_NODE_BINARY || "minizinc",
  });
});

afterAll(() => {
  MiniZinc.shutdown();
});

commonTests(MiniZinc);

test("Load from filesystem", async () => {
  const model = new MiniZinc.Model();
  model.addFile(path.join(__dirname, "test.mzn"));
  const result = await model.solve();
  const x = result.solution.output.json.x;
  expect(x).toBeGreaterThanOrEqual(1);
  expect(x).toBeLessThanOrEqual(3);
});
