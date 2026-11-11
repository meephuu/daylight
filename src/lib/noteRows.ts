/**
 * Lists inside a note. The note stays plain text with one line per row; a line can be
 *   ordinary text      Buy milk
 *   a bullet           - Buy milk
 *   a numbered item    1. Buy milk
 *   a checkbox item    - [ ] Buy milk     (- [x] when ticked)
 * so nothing in the database changed and old notes read exactly as before.
 */
export type RowKind = "text" | "bullet" | "number" | "check";

export interface NoteRow {
  kind: RowKind;
  text: string;
  /** Only meaningful for "check". */
  checked: boolean;
  /** Only meaningful for "number"; runs of numbered rows are renumbered by normalizeRows. */
  number: number;
}

export interface RowEdit {
  rows: NoteRow[];
  /** Where the caret goes afterwards. */
  focus: { index: number; caret: number };
}

const CHECK = /^- \[( |x|X)\] ?(.*)$/;
const BULLET = /^[-*] (.*)$/;
const NUMBER = /^(\d{1,4})\. (.*)$/;

const row = (kind: RowKind, text: string, extra: Partial<Pick<NoteRow, "checked" | "number">> = {}): NoteRow => ({
  kind,
  text,
  checked: extra.checked ?? false,
  number: extra.number ?? 1,
});

export function parseRows(content: string): NoteRow[] {
  return content.split("\n").map((line) => {
    const check = CHECK.exec(line);
    if (check) return row("check", check[2] ?? "", { checked: check[1] !== " " });
    const bullet = BULLET.exec(line);
    if (bullet) return row("bullet", bullet[1] ?? "");
    const number = NUMBER.exec(line);
    if (number) return row("number", number[2] ?? "", { number: Number(number[1]) });
    return row("text", line);
  });
}

/** A run of numbered rows counts up from its first number: 1, 2, 3 ... whatever was inserted or removed. */
export function normalizeRows(rows: NoteRow[]): NoteRow[] {
  let expected = 0;
  return rows.map((current, index) => {
    if (current.kind !== "number") return current;
    const previous = rows[index - 1];
    expected = previous && previous.kind === "number" ? expected + 1 : current.number;
    return { ...current, number: expected };
  });
}

export function serializeRows(rows: NoteRow[]): string {
  return normalizeRows(rows)
    .map((current) => {
      switch (current.kind) {
        case "check":
          return `- [${current.checked ? "x" : " "}] ${current.text}`;
        case "bullet":
          return `- ${current.text}`;
        case "number":
          return `${current.number}. ${current.text}`;
        default:
          return current.text;
      }
    })
    .join("\n");
}

/** True when the note has any bullet, numbered or checkbox line. */
export function hasList(content: string): boolean {
  return parseRows(content).some((current) => current.kind !== "text");
}

/** The note text without the list markers, for searching. */
export function plainText(content: string): string {
  return parseRows(content)
    .map((current) => current.text)
    .join("\n");
}

/** Number of the line a caret position falls on. */
export function lineIndexAt(content: string, caret: number): number {
  return content.slice(0, Math.max(0, caret)).split("\n").length - 1;
}

/** What a line made only of a just-typed marker ("- ", "1. ", "[] ") turns into, or null. */
export function shortcutFromLine(line: string): { kind: RowKind; number: number } | null {
  if (line === "- " || line === "* ") return { kind: "bullet", number: 1 };
  if (line === "[] " || line === "[ ] ") return { kind: "check", number: 1 };
  const number = /^(\d{1,3})\. $/.exec(line);
  return number ? { kind: "number", number: Number(number[1]) } : null;
}

/**
 * Typing a marker at the start of an ordinary line ("- ", "1. ", "[] ") turns the line into that kind
 * of item and keeps whatever text follows it. Null when the text does not start with a marker.
 */
export function applyShortcut(rows: NoteRow[], index: number, value: string): RowEdit | null {
  const current = rows[index];
  if (!current || current.kind !== "text") return null;
  let next: NoteRow | null = null;
  const bullet = /^[-*] (.*)$/s.exec(value);
  const number = /^(\d{1,3})\. (.*)$/s.exec(value);
  const check = /^\[( |x|X)?\] (.*)$/s.exec(value);
  if (bullet) next = row("bullet", bullet[1] ?? "");
  else if (number) next = row("number", number[2] ?? "", { number: Number(number[1]) });
  else if (check) next = row("check", check[2] ?? "", { checked: check[1] === "x" || check[1] === "X" });
  if (!next) return null;
  return { rows: rows.map((r, i) => (i === index ? (next as NoteRow) : r)), focus: { index, caret: 0 } };
}

/** Turns the line into the given kind of item, keeping its text (and a ticked box stays ticked). */
export function convertTo(rows: NoteRow[], index: number, kind: RowKind): RowEdit {
  const next = rows.map((r, i) => (i === index ? { ...r, kind, checked: kind === "check" ? r.kind === "check" && r.checked : false } : r));
  return { rows: next, focus: { index, caret: rows[index]?.text.length ?? 0 } };
}

/** Adds an empty item of the given kind after the row (or at the end when index is null). */
export function insertItemAfter(rows: NoteRow[], index: number | null, kind: RowKind): RowEdit {
  const at = index === null ? rows.length : index + 1;
  const next = [...rows.slice(0, at), row(kind, ""), ...rows.slice(at)];
  return { rows: next, focus: { index: at, caret: 0 } };
}

export function toggleItem(rows: NoteRow[], index: number): NoteRow[] {
  return rows.map((r, i) => (i === index && r.kind === "check" ? { ...r, checked: !r.checked } : r));
}

export function setText(rows: NoteRow[], index: number, text: string): NoteRow[] {
  return rows.map((r, i) => (i === index ? { ...r, text } : r));
}

/**
 * Enter: an empty item ends the list (it becomes an ordinary line); otherwise the line splits at the
 * caret and the new line continues the same kind of list (a fresh unticked box, the next number).
 */
export function pressEnter(rows: NoteRow[], index: number, caret: number): RowEdit {
  const current = rows[index];
  if (!current) return { rows, focus: { index, caret } };
  if (current.kind !== "text" && current.text === "") {
    return { rows: rows.map((r, i) => (i === index ? row("text", "") : r)), focus: { index, caret: 0 } };
  }
  const before = current.text.slice(0, caret);
  // A new list item does not start with the space the caret was in front of.
  const after = current.kind === "text" ? current.text.slice(caret) : current.text.slice(caret).trimStart();
  const inserted = row(current.kind, after, { number: current.number + 1 });
  const next = [...rows.slice(0, index), { ...current, text: before }, inserted, ...rows.slice(index + 1)];
  return { rows: next, focus: { index: index + 1, caret: 0 } };
}

/**
 * Backspace with the caret at the very start of a line: a list item turns back into an ordinary line;
 * an ordinary line joins the one above. Returns null when there is nothing to do.
 */
export function pressBackspaceAtStart(rows: NoteRow[], index: number): RowEdit | null {
  const current = rows[index];
  if (!current) return null;
  if (current.kind !== "text") {
    return { rows: rows.map((r, i) => (i === index ? row("text", r.text) : r)), focus: { index, caret: 0 } };
  }
  const previous = rows[index - 1];
  if (!previous) return null;
  const next = [...rows.slice(0, index - 1), { ...previous, text: previous.text + current.text }, ...rows.slice(index + 1)];
  return { rows: next, focus: { index: index - 1, caret: previous.text.length } };
}

/** Text typed or pasted into a row that contains line breaks becomes several rows of the same kind. */
export function splitOnNewlines(rows: NoteRow[], index: number, value: string): RowEdit {
  const current = rows[index];
  const pieces = value.split(/\r?\n/);
  if (!current || pieces.length === 1) return { rows: setText(rows, index, value), focus: { index, caret: value.length } };
  const added = pieces.slice(1).map((text, offset) => row(current.kind, text, { number: current.number + offset + 1 }));
  const next = [...rows.slice(0, index), { ...current, text: pieces[0] ?? "" }, ...added, ...rows.slice(index + 1)];
  const last = pieces[pieces.length - 1] ?? "";
  return { rows: next, focus: { index: index + pieces.length - 1, caret: last.length } };
}

/** What a list conversion replaced, so Ctrl+Z can put it back. */
export interface Conversion {
  index: number;
  /** The row as it was before: an ordinary line for a typed marker, or the earlier kind of item. */
  before: NoteRow;
  /** The kind the row was converted to; undo only applies while the row still has it. */
  kind: RowKind;
}

/**
 * Undoes a conversion: the row goes back to how it was and keeps the text typed since. A typed marker
 * ("- ", "1. ", "[] ") is not put back as characters, because a line starting with "- " is a bullet
 * in the saved text; the line simply becomes ordinary text.
 */
export function revertConversion(rows: NoteRow[], conversion: Conversion, caretInText: number): RowEdit | null {
  const current = rows[conversion.index];
  if (!current || current.kind !== conversion.kind) return null;
  const restored: NoteRow = { ...conversion.before, text: current.text };
  return {
    rows: rows.map((r, i) => (i === conversion.index ? restored : r)),
    focus: { index: conversion.index, caret: caretInText },
  };
}
