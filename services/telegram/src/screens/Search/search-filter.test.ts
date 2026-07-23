/**
 * Pin the substring + rank contract — earlier match wins, ties broken by
 * shorter title. Locale-lowercase means CAP matches «cap theorem» and the
 * Cyrillic query «Каф» matches «Кафка».
 */

import { describe, expect, test } from 'vitest';

import type { ConspectusRow } from './hooks/useConspectusesList';
import { filterConspectuses, splitAtMatch } from './search-filter';

function row(title: string | null, uuid = title ?? 'x'): ConspectusRow {
  return { conspectus_uuid: uuid, title, slot: 'A', schedule_revision: 1 } as ConspectusRow;
}

describe('filterConspectuses', () => {
  test('returns empty when query is empty / whitespace', () => {
    const rows = [row('CAP theorem'), row('Kafka')];
    expect(filterConspectuses(rows, '')).toEqual([]);
    expect(filterConspectuses(rows, '   ')).toEqual([]);
  });

  test('substring match is case-insensitive', () => {
    const rows = [row('CAP theorem trade-offs'), row('Kafka rebalancing')];
    const hits = filterConspectuses(rows, 'cap');
    expect(hits).toHaveLength(1);
    expect(hits[0].row.title).toBe('CAP theorem trade-offs');
    expect(hits[0].matchStart).toBe(0);
    expect(hits[0].matchLength).toBe(3);
  });

  test('ranks earlier-match first, then shorter-title', () => {
    const rows = [
      row('Reasoning about the SRP', 'a'),
      row('SRP violations in practice', 'b'),
      row('SRP', 'c'),
    ];
    const hits = filterConspectuses(rows, 'SRP');
    // 'SRP' (row c, matchStart 0, shortest) and 'SRP violations…' (row b,
    // matchStart 0) both tie on matchStart 0. Shorter title wins → c first,
    // then b, then a (matchStart 15).
    expect(hits.map((h) => h.row.conspectus_uuid)).toEqual(['c', 'b', 'a']);
  });

  test('handles null title gracefully (untitled rows never match)', () => {
    const rows = [row(null, 'null-a'), row('SRP', 'srp')];
    const hits = filterConspectuses(rows, 'SRP');
    expect(hits.map((h) => h.row.conspectus_uuid)).toEqual(['srp']);
  });

  test('locale-lowercase covers Cyrillic', () => {
    const rows = [row('Кафка · rebalancing')];
    const hits = filterConspectuses(rows, 'каф');
    expect(hits).toHaveLength(1);
    expect(hits[0].matchStart).toBe(0);
  });
});

describe('splitAtMatch', () => {
  test('splits title into before + match + after', () => {
    const rows = [row('CAP theorem trade-offs')];
    const [hit] = filterConspectuses(rows, 'theorem');
    expect(splitAtMatch(hit)).toEqual({
      before: 'CAP ',
      match: 'theorem',
      after: ' trade-offs',
    });
  });

  test('preserves original case for highlight even when query is lower', () => {
    const rows = [row('CAP theorem')];
    const [hit] = filterConspectuses(rows, 'cap');
    // The match string preserves original casing so the highlight reads
    // «CAP» even though the user typed «cap».
    expect(splitAtMatch(hit).match).toBe('CAP');
  });
});
