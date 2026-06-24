// SPDX-FileCopyrightText: Copyright 2026 Element Creations Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

// Normalizes plural/select messages in the downloaded translations so they
// compile with formatjs.
//
// CLDR languages such as Ukrainian, Russian or Polish have `one`/`few`/`many`
// plural categories on top of `other`. Localazy only exports the categories a
// translator actually filled in, so a translation can end up as e.g.
//   {COUNT, plural, one {…} few {…} many {…}}
// which is missing the `other` clause that ICU MessageFormat mandates, and
// `formatjs compile-folder` then bails out with MISSING_OTHER_CLAUSE.
//
// For every plural/select that lacks an `other` clause we inject one by copying
// the most appropriate existing branch (many → few → two → one → last). For
// these languages `other` is only ever hit by fractional values, so reusing the
// `many` wording is exactly what a translator would do.
//
// Messages that fail to parse for any other reason (e.g. a truncated string) are
// left untouched and reported — those are genuine translation bugs to fix at the
// source.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "@formatjs/icu-messageformat-parser";
import { printAST } from "@formatjs/icu-messageformat-parser/printer.js";

const TRANSLATED_DIR = "translations/translated";
const FALLBACK_ORDER = ["many", "few", "two", "one", "zero"];

/** @returns {boolean} whether anything was changed */
function ensureOtherClause(elements) {
  let changed = false;
  for (const el of elements) {
    if (el.options) {
      if (!el.options.other) {
        const keys = Object.keys(el.options);
        const fallbackKey =
          FALLBACK_ORDER.find((k) => el.options[k]) ?? keys.at(-1);
        el.options.other = { value: el.options[fallbackKey].value };
        changed = true;
      }
      for (const key of Object.keys(el.options)) {
        changed = ensureOtherClause(el.options[key].value) || changed;
      }
    }
    if (Array.isArray(el.children)) {
      changed = ensureOtherClause(el.children) || changed;
    }
  }
  return changed;
}

let totalFixed = 0;
const failures = [];

for (const file of readdirSync(TRANSLATED_DIR)) {
  if (!file.endsWith(".json")) continue;
  const path = join(TRANSLATED_DIR, file);
  const data = JSON.parse(readFileSync(path, "utf8"));
  let fileChanged = false;

  for (const [id, entry] of Object.entries(data)) {
    let ast;
    try {
      ast = parse(entry.message, { requiresOtherClause: false });
    } catch (error) {
      failures.push(`${file} → ${id}: ${error.message}`);
      continue;
    }

    if (ensureOtherClause(ast)) {
      entry.message = printAST(ast);
      fileChanged = true;
      totalFixed += 1;
      console.log(`  fixed ${file} → ${id}`);
    }
  }

  if (fileChanged) {
    writeFileSync(path, `${JSON.stringify(data, undefined, 2)}\n`);
  }
}

console.log(
  `i18n-normalize-plurals: added "other" clause to ${totalFixed} message(s).`,
);

if (failures.length > 0) {
  console.error(
    "\nThe following messages could not be parsed and were left untouched:",
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nThese are malformed translations — fix them in Localazy (or by hand).",
  );
  process.exitCode = 1;
}
