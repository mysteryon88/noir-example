import { NoirCircuit } from "./noir";

describe("Noir", () => {
  const main = new NoirCircuit();
  const recursive = new NoirCircuit();

  beforeEach(async () => {
    // compile
    await main.compile("main");
    await main.setup();

    await recursive.compile("recursive");
    await recursive.setup();
  });

  afterEach(async () => {
    await main.destroyBackend();
    await recursive.destroyBackend();
  });

  test("prove and verify", async () => {
    // first input
    const mainInput = { x: 1, y: 2 };

    // first proof
    await main.prove(mainInput);

    // first verify
    let verified = await main.verify();
    expect(verified).toBe(true);

    // recursion preparation
    const numPublicInputs = 1;
    const { proofAsFields, vkAsFields, vkHash } =
      await main.getRecursiveProofArtifacts(numPublicInputs);

    expect(vkAsFields).toHaveLength(114);
    expect(typeof vkHash).toBe("string");

    // second input
    let recursiveInputs = {
      verification_key: vkAsFields,
      proof: proofAsFields,
      public_inputs: [mainInput.y],
      key_hash: vkHash,
    };

    // second proof
    await recursive.prove(recursiveInputs);

    // second verify
    verified = await recursive.verify();
    expect(verified).toBe(true);
    // test runs for 52-54 seconds
  }, 100000);
});
