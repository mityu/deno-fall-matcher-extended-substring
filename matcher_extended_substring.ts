import { defineMatcher, type Matcher } from "@vim-fall/std/matcher";

/**
 * Represents the test results.
 * The `status` member indicates the result status of tests and can take the
 * following values.
 *  - "can-keep": The item can be kept unless any other test results in "should-exclude".
 *  - "should-exclude": The item should be filtered.
 *  - "none": This result doesn't take any effect on filtering.
 */
type TestResult = {
  /**
   * The item status against the given query.
   */
  itemStatus: "can-keep";

  /**
   * The matched position.
   */
  matchPosition: {
    column: number;
    length: number;
  };
} | {
  /**
   * The item status against the given query.
   */
  itemStatus: "should-exclude" | "none";
};

type Tester = (
  item: string,
  query: string,
) => TestResult;

type Matchers = {
  query: string;
  tester: Tester;
}[];

function testerSubstring(item: string, query: string): TestResult {
  const index = item.indexOf(query);
  if (index < 0) {
    return { itemStatus: "should-exclude" };
  }
  return {
    itemStatus: "can-keep",
    matchPosition: { column: index + 1, length: strlen(query) },
  };
}

function testerStartsWith(item: string, query: string): TestResult {
  if (item.startsWith(query)) {
    return {
      itemStatus: "can-keep",
      matchPosition: { column: 1, length: strlen(query) },
    };
  }
  return { itemStatus: "should-exclude" };
}

function testerEndsWith(item: string, query: string): TestResult {
  if (item.endsWith(query)) {
    const itemLen = strlen(item);
    const queryLen = strlen(query);
    return {
      itemStatus: "can-keep",
      matchPosition: { column: itemLen - queryLen + 1, length: queryLen },
    };
  }
  return { itemStatus: "should-exclude" };
}

function testerExclude(item: string, query: string): TestResult {
  const index = item.indexOf(query);
  if (index >= 0) {
    return { itemStatus: "should-exclude" };
  }
  return { itemStatus: "none" };
}

// Split input string by unescaped whitespace
export function splitUserQuery(query: string): string[] {
  const sep = /(?<!(?<=(?:^|[^\\])(?:\\\\)*)\\)\s+/;
  return query.split(sep).filter((v) => v.length != 0);
}

export function removeBackslashBeforeSpecialChar(input: string): string {
  function aux(acc: string, input: string): string {
    const idx = input.indexOf("\\");
    if (idx < 0) {
      return acc + input;
    } else {
      acc = acc + input.slice(0, idx);
      const nextChar = input.charAt(idx + 1);
      input = input.slice(idx + 2);

      if (nextChar === "") {
        // No more string left.
        return acc + "\\";
      } else if (nextChar === "\\" || nextChar === " ") {
        return aux(acc + nextChar, input);
      } else if (nextChar === "$") {
        if (input.length === 0) {
          // Escape "$" only when it's at the end of input.
          return acc + "$";
        }
        return aux(acc + "\\$", input);
      } else if (nextChar === "^" || nextChar === "!") {
        // Escape "^" or "!" only when it is at the start of input.
        if (acc.length === 0) {
          return aux(nextChar, input);
        }
        return aux(acc + "\\" + nextChar, input);
      } else {
        return aux(acc + "\\" + nextChar, input);
      }
    }
  }
  return aux("", input);
}

function parseUserQuery(query: string): Matchers {
  const matchers = [] as Matchers;

  splitUserQuery(query).forEach((v) => {
    const tailDollar = /(?<!(?<=(?:^|[^\\])(?:\\\\)*)\\)\$$/;
    if (v.startsWith("^")) {
      matchers.push({
        query: removeBackslashBeforeSpecialChar(v.substring(1)),
        tester: testerStartsWith,
      });
    } else if (v.startsWith("!")) {
      matchers.push({
        query: removeBackslashBeforeSpecialChar(v.substring(1)),
        tester: testerExclude,
      });
    } else if (tailDollar.test(v)) {
      matchers.push({
        query: removeBackslashBeforeSpecialChar(v.substring(0, v.length - 1)),
        tester: testerEndsWith,
      });
    } else {
      matchers.push({
        query: removeBackslashBeforeSpecialChar(v),
        tester: testerSubstring,
      });
    }
  });

  return matchers;
}

function strlen(s: string): number {
  return (new TextEncoder()).encode(s).length;
}

/**
 * Options for substring matching.
 *
 * - `ignoreCase`: Enables case-insensitive matching regardless of query casing.
 * - `smartCase`: Turns off `ignoreCase` when query contains upper-cased characters.
 *    This has no effect when `ignoreCase` option is off.
 */
export type ExtendedSubstringOptions = {
  ignoreCase?: boolean;
  smartCase?: boolean;
};

export const extendedSubstring = (
  opts?: ExtendedSubstringOptions,
): Matcher => {
  return defineMatcher(async function* (_denops, { query, items }, { signal }) {
    const ignoreCase = opts?.ignoreCase &&
      !(opts?.smartCase && /[A-Z]/.test(query));

    const matchers = parseUserQuery(ignoreCase ? query.toLowerCase() : query);

    if (matchers.length === 0) {
      // Query is equals to empty query.
      yield* items;
      return;
    }

    for await (const item of items) {
      signal?.throwIfAborted();

      const text = ignoreCase ? item.value.toLowerCase() : item.value;
      const matches = matchers.map(({ query, tester }) => tester(text, query));

      if (
        matches.some((v) => v.itemStatus === "should-exclude") ||
        !matches.some((v) => v.itemStatus === "can-keep")
      ) {
        continue;
      }

      const decorations = matches
        .filter((v) => v.itemStatus === "can-keep")
        .map((v) => v.matchPosition);
      yield {
        ...item,
        decorations: [...(item.decorations ?? []), ...decorations],
      };
    }
  });
};
