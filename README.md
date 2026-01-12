# fall-source-mr-mixed

A matcher for [fall.vim](https://github.com/vim-fall/fall.vim) that basically
filters items based on query substrings but with some filter commands (e.g.
filter items only when the query matches at the head of them).

## Search queries

Items are filtered by their text matches for all of the queries, where queries
is a space-separated list of the search text.
Basically, text matches a query when the text contains the query text, but when
a query is formed specially, i.e. a query have search specifier, the matching
will be done in another way.
The following is a list of available special-form queries and how they match
for texts.

- `^{query}`
  - Matches only when `{query}` appears at the head of text.
- `{query}$`
  - Matches only when `{query}` appears at the end of text.
- `!{query}`
  - Filter-out items when their text contains `{query}`.  In other words, items match when their text does not contain `{query}`.

You cannot use multiple search specifier at once.  In other words, you cannot
write `^{query}$` to match items whose text starts and ends with `{query}`.
It is undefined that `^{query}$` is treated as a query that matches text when
it starts with `{query}$` or matches text when it ends with `^{query}`.

These are examples of basic queries and what kind of text matches or doesn't match to them:

|Query|Match|Not-match|
|:--:|:--|:--|
|`abc`|`abc`, `XabcX`, ...|`xyz`, `ab`, ...|
|`^abc`|`abc`, `abcxyz`, ...|`xabc`, `ab`, ...|
|`xyz$`|`xyz`, `wxyz`, ...|`xyza`, `yz`, `xy`, ...|
|`!abc xyz`|`xyz`, ...|`abcxyz`, ...|

Search specifiers (e.g. `^`, `$`, etc) and white spaces can be escaped by backslash
so that they are included in queries: for example, the query `\^abc` matches
`^abc`, `x^abc`, etc, and doesn't match `abc`.

## Example

For the details of source options or etc, please check
[@mityu/fall-matcher-extended-substring](https://jsr.io/@mityu/fall-matcher-extended-substring).

```typescript
// In your custom.ts
import type { Entrypoint } from "jsr:@vim-fall/custom";
import * as builtin from "jsr:@vim-fall/std/builtin";
import { extendedSubstring } from "jsr:@mityu/fall-matcher-extended-substring";

export const main: Entrypoint = ({ definePickerFromSource }) => {
  definePickerFromSource(
    "file",
    builtin.source.file,
    {
      matchers: [extendedSubstring],
      previewers: [builtin.previewer.file],
      actions: {
        ...builtin.action.defaultOpenActions,
        ...builtin.action.defaultQuickfixActions,
      },
      defaultAction: "open",
    },
  );
};
```
