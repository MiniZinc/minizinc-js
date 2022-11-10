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
