import { describe, it, expect } from "vitest";
import * as C from "../src/constants.js";
import fixtures from "./fixtures/abi-fixtures.json";

describe("constants match Solidity", () => {
  describe("states", () => {
    it.each(Object.entries(fixtures.constants.states))(
      "%s matches",
      (name, expected) => {
        const actual = C[name as keyof typeof C] as string;
        expect(actual.toLowerCase()).toBe(expected.toLowerCase());
      },
    );
  });

  describe("inputs", () => {
    it.each(Object.entries(fixtures.constants.inputs))(
      "%s matches",
      (name, expected) => {
        const actual = C[name as keyof typeof C] as string;
        expect(actual.toLowerCase()).toBe(expected.toLowerCase());
      },
    );
  });

  describe("actions", () => {
    it.each(Object.entries(fixtures.constants.actions))(
      "%s matches",
      (name, expected) => {
        const actual = C[name as keyof typeof C] as string;
        expect(actual.toLowerCase()).toBe(expected.toLowerCase());
      },
    );
  });

  describe("outcomes", () => {
    it.each(Object.entries(fixtures.constants.outcomes))(
      "%s matches",
      (name, expected) => {
        const actual = C[name as keyof typeof C] as string;
        expect(actual.toLowerCase()).toBe(expected.toLowerCase());
      },
    );
  });
});
