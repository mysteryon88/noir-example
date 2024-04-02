import { Noir } from "@noir-lang/noir_js";
import { compile, createFileManager } from "@noir-lang/noir_wasm";
import { BarretenbergBackend } from "@noir-lang/backend_barretenberg";
import { ProofData, CompiledCircuit } from "@noir-lang/types";
import { join, resolve } from "path";

export class NoirCircuit {
  compiledCircuit?: CompiledCircuit;
  backend?: BarretenbergBackend;
  noir?: Noir;
  proof?: ProofData;

  async compile(name: string): Promise<CompiledCircuit> {
    const basePath = resolve(join("./circuits", name));
    const fm = createFileManager(basePath);
    const compiled = await compile(fm, basePath);
    if (!("program" in compiled)) {
      throw new Error("Compilation failed");
    }
    this.compiledCircuit = compiled.program;
    return this.compiledCircuit;
  }

  async setup() {
    if (!this.compiledCircuit) {
      throw new Error("Circuit must be compiled before setup");
    }
    this.backend = new BarretenbergBackend(this.compiledCircuit, {
      threads: 8,
    });
    this.noir = new Noir(this.compiledCircuit, this.backend);
  }

  async destroyBackend() {
    if (!this.backend) {
      throw new Error("Backend not initialized");
    }
    await this.backend.destroy();
  }

  async prove(inputs: any) {
    if (!this.noir) {
      throw new Error("Noir not initialized. Call setup first.");
    }
    const { witness } = await this.noir.execute(inputs);

    if (!this.backend) {
      throw new Error("Backend not initialized. Call setup first.");
    }

    this.proof = await this.backend.generateProof(witness);

    if (!(this.proof.proof instanceof Uint8Array)) {
      throw new Error("proof must be an instance of Uint8Array");
    }
  }

  async verify(proof?: ProofData): Promise<boolean> {
    if (!this.backend) {
      throw new Error("Backend not initialized or proof not generated");
    }

    const proofToVerify = proof || this.proof;

    if (!proofToVerify) {
      throw new Error("Proof not provided and not generated");
    }

    const verified = await this.backend.verifyProof(proofToVerify);

    if (!verified) {
      throw new Error("Verification failed");
    }

    return verified;
  }

  async getRecursiveProofArtifacts(
    numPublicInputs: number,
    proof?: ProofData
  ): Promise<{
    proofAsFields: string[];
    vkAsFields: string[];
    vkHash: string;
  }> {
    if (!this.backend) {
      throw new Error("Backend not initialized");
    }

    const actualProof = proof || this.proof;

    if (!actualProof) {
      throw new Error("Proof not provided and not generated");
    }

    const artifacts = await this.backend.generateRecursiveProofArtifacts(
      actualProof,
      numPublicInputs
    );
    return {
      proofAsFields: artifacts.proofAsFields,
      vkAsFields: artifacts.vkAsFields,
      vkHash: artifacts.vkHash,
    };
  }

  getProofData(): { proof: Uint8Array; publicInputs: string[] } {
    if (!this.proof || !this.proof.proof) {
      throw new Error("Proof data not available");
    }

    return { proof: this.proof.proof, publicInputs: this.proof.publicInputs };
  }
}
