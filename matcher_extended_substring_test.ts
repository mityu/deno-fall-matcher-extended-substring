import type { Denops } from "@denops/std";
import { DenopsStub } from "@denops/test";
import { assertEquals } from "@std/assert";
import { enumerate } from "@core/iterutil/enumerate";
import type { Detail, IdItem, Matcher, MatchParams } from "@vim-fall/std";
import { derive } from "@vim-fall/custom/derivable";
import {
  extendedSubstring,
  removeBackslashBeforeSpecialChar,
  splitUserQuery,
} from "./matcher_extended_substring.ts";

type TestCase<T extends Detail> = {
  description?: string;
  items: IdItem<T>[];
  query: string;
  matcher: Matcher<T>;
  result: IdItem<T>[];
};

/**
 * Build list of IdItem<Detail> from given list of strings with the 0-indexed
 * sequence of ids.
 */
function buildItems(
  items: string[],
): IdItem<Detail>[] {
  return items.map((value, id) => ({ id, value, detail: {} } satisfies Detail));
}

function collectMatches<T extends Detail>(
  denops: Denops,
  matcher: Matcher<T>,
  param: MatchParams<T>,
): Promise<IdItem<T>[]> {
  return Array.fromAsync(matcher.match(denops, param, {}));
}

async function runParametarized<T extends Detail>(
  t: Deno.TestContext,
  denops: Denops,
  cases: TestCase<T>[],
) {
  for (const [i, v] of enumerate(cases)) {
    const description = v.description ? `${v.description}: ` : "";
    await t.step(
      `${description}(idx, query) = (${i}, "${v.query}")`,
      async () => {
        const matched = await collectMatches(
          denops,
          v.matcher,
          {
            query: v.query,
            items: v.items,
          },
        );
        assertEquals(matched, v.result);
      },
    );
  }
}

Deno.test("splitUserQuery()", async (t) => {
  const cases = [
    { query: "a b", result: ["a", "b"] },
    { query: String.raw`a\ b`, result: ["a\\ b"] },
    { query: String.raw`a\\ b`, result: [String.raw`a\\`, "b"] },
    { query: String.raw`a\\\  b`, result: [String.raw`a\\\ `, "b"] },
  ];

  for (const { query, result } of cases) {
    await t.step(`input: "${query}"`, () => {
      assertEquals(splitUserQuery(query), result);
    });
  }
});

Deno.test("removeBackslashBeforeSpecialChar()", async (t) => {
  const cases = [
    { query: String.raw`a\ b`, result: "a b" },
    { query: String.raw`\^a`, result: "^a" },
    { query: String.raw`a\$`, result: "a$" },
    { query: String.raw`\!a`, result: "!a" },
    { query: String.raw`a\\`, result: "a\\" },
    { query: String.raw`a\\\ `, result: "a\\ " },
    { query: String.raw`a\^b`, result: String.raw`a\^b` },
    { query: String.raw`a\$b`, result: String.raw`a\$b` },
    { query: String.raw`a\!b`, result: String.raw`a\!b` },
    { query: String.raw`\ \ a\ b`, result: String.raw`  a b` },
  ];

  for (const { query, result } of cases) {
    await t.step(`input: "${query}"`, () => {
      assertEquals(removeBackslashBeforeSpecialChar(query), result);
    });
  }
});

Deno.test("extended-substring matcher", async (t) => {
  const denops = new DenopsStub({});

  await t.step("check filtering by naiive substring", async (t) => {
    await t.step("with noignorecase (default)", async (t) => {
      const cases = [
        {
          description: "Exclude unmathced items",
          items: buildItems(["itema", "itemA", "hoge", "an-item-x"]),
          query: "item",
          result: [
            {
              id: 0,
              value: "itema",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 1,
              value: "itemA",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 3,
              value: "an-item-x",
              decorations: [{ column: 4, length: 4 }],
              detail: {},
            },
          ],
        },
        {
          description: "Don't match with upper cased letter",
          items: buildItems(["itema", "itemA"]),
          query: "itema",
          result: [
            {
              id: 0,
              value: "itema",
              decorations: [{ column: 1, length: 5 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({ ...v, matcher: derive(extendedSubstring) }));

      await runParametarized(t, denops, cases);
    });

    await t.step("with ignorecase", async (t) => {
      const cases = [
        {
          description: "Exclude unmathced items",
          items: buildItems(["item", "ITEM", "hoge", "an-item-x"]),
          query: "itEm",
          result: [
            {
              id: 0,
              value: "item",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 1,
              value: "ITEM",
              decorations: [{ column: 1, length: 4 }],
              detail: {},
            },
            {
              id: 3,
              value: "an-item-x",
              decorations: [{ column: 4, length: 4 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({
        ...v,
        matcher: derive(extendedSubstring({ ignoreCase: true })),
      }));

      await runParametarized(t, denops, cases);
    });

    await t.step("with smartcase", async (t) => {
      const cases = [
        {
          description: "ignores case",
          items: buildItems(["xxx", "XXX", "xXx"]),
          query: "xxx",
          result: [
            {
              id: 0,
              value: "xxx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
            {
              id: 1,
              value: "XXX",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
            {
              id: 2,
              value: "xXx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        },
        {
          description: "respects case",
          items: buildItems(["xxx", "XXX", "xXx"]),
          query: "xXx",
          result: [
            {
              id: 2,
              value: "xXx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({
        ...v,
        matcher: derive(
          extendedSubstring({ ignoreCase: true, smartCase: true }),
        ),
      }));

      await runParametarized(t, denops, cases);
    });

    await t.step(
      "standalone smartcase doesn't have effects",
      async (t) => {
        await runParametarized(t, denops, [{
          matcher: derive(
            extendedSubstring({ smartCase: true }),
          ),
          items: buildItems(["xxx", "XXX", "xXx"]),
          query: "xxx",
          result: [
            {
              id: 0,
              value: "xxx",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        }]);
      },
    );

    await t.step("Multiple substring", async (t) => {
      await runParametarized(t, denops, [
        {
          description: "Split query",
          matcher: derive(extendedSubstring),
          items: buildItems(["a b", "ab", "bca", "ac"]),
          query: "a b",
          result: [
            {
              id: 0,
              value: "a b",
              decorations: [{ column: 1, length: 1 }, { column: 3, length: 1 }],
              detail: {},
            },
            {
              id: 1,
              value: "ab",
              decorations: [{ column: 1, length: 1 }, { column: 2, length: 1 }],
              detail: {},
            },
            {
              id: 2,
              value: "bca",
              decorations: [{ column: 3, length: 1 }, { column: 1, length: 1 }],
              detail: {},
            },
          ],
        },
      ]);
    });
  });

  await t.step("check search operators", async (t) => {
    await t.step("Match only head", async (t) => {
      const cases = [
        {
          items: buildItems(["abc", "abcxyz", "xabc", " abc", "xyz abc"]),
          query: "^abc",
          result: [
            {
              id: 0,
              value: "abc",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
            {
              id: 1,
              value: "abcxyz",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({ ...v, matcher: derive(extendedSubstring) }));

      await runParametarized(t, denops, cases);
    });

    await t.step("Match only tail", async (t) => {
      const cases = [
        {
          items: buildItems(["abc", "xyzabc", "abcX", "abc ", "abc xyz"]),
          query: "abc$",
          result: [
            {
              id: 0,
              value: "abc",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
            {
              id: 1,
              value: "xyzabc",
              decorations: [{ column: 4, length: 3 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({ ...v, matcher: derive(extendedSubstring) }));

      await runParametarized(t, denops, cases);
    });

    await t.step("Exclude keyword", async (t) => {
      const cases = [
        {
          items: buildItems(["abc", "hoge", "fuga piyo", "!abc"]),
          query: "!abc",
          result: [],
        },
        {
          items: buildItems(["xyz", "abcxyz", "xxx", "xyz !abc"]),
          query: "xyz !abc",
          result: [
            {
              id: 0,
              value: "xyz",
              decorations: [{ column: 1, length: 3 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({ ...v, matcher: derive(extendedSubstring) }));

      await runParametarized(t, denops, cases);
    });

    await t.step("Escape search operators", async (t) => {
      const cases = [
        {
          items: buildItems([String.raw`x\^abcx`, "abc"]),
          query: String.raw`\^abc`,
          result: [
            {
              id: 0,
              value: String.raw`x\^abcx`,
              decorations: [{ column: 3, length: 4 }],
              detail: {},
            },
          ],
        },
        {
          items: buildItems(["xabc$x", "abc", String.raw`abc\$`]),
          query: String.raw`abc\$`,
          result: [
            {
              id: 0,
              value: "xabc$x",
              decorations: [{ column: 2, length: 4 }],
              detail: {},
            },
          ],
        },
        {
          items: buildItems([String.raw`x\!abcx`, "xyz"]),
          query: String.raw`\!abc`,
          result: [
            {
              id: 0,
              value: String.raw`x\!abcx`,
              decorations: [{ column: 3, length: 4 }],
              detail: {},
            },
          ],
        },
      ].map((v) => ({ ...v, matcher: derive(extendedSubstring) }));

      await runParametarized(t, denops, cases);
    });
  });
});
