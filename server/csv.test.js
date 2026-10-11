import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "./csv.js";

test("parseCsv maps headers and ignores blank rows", () => {
  assert.deepEqual(parseCsv("userId,name\r\nada-1,Ada\r\n\r\n"), [{ userId: "ada-1", name: "Ada" }]);
});

test("parseCsv handles commas and escaped quotes in quoted fields", () => {
  assert.deepEqual(parseCsv('name,notes\n"Ada Lovelace","Said ""hello, school"""'), [{ name: "Ada Lovelace", notes: 'Said "hello, school"' }]);
});

test("parseCsv tolerates missing trailing values and a UTF-8 BOM", () => {
  assert.deepEqual(parseCsv("\uFEFFuserId,name,section\nali,Ali"), [{ userId: "ali", name: "Ali", section: "" }]);
});
