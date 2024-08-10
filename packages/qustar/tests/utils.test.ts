import {describe, expect, test} from 'vitest';
import {
  compare,
  deepEntries,
  deepEqual,
  isNumberString,
  like,
  setPath,
} from '../src/utils.js';

describe('utils', async () => {
  test('deepEqual', () => {
    expect(deepEqual({a: 1, b: [1, 2]}, {a: 1, b: [1, 2]})).to.equal(true);
    expect(deepEqual({a: 1, b: [1, 2]}, {a: 1, b: [2, 1]})).to.equal(false);
    expect(deepEqual(new Set([1, 2, 3]), new Set([1, 2, 3]))).to.equal(true);
    expect(
      deepEqual(
        new Map([
          [1, 'a'],
          [2, 'b'],
        ]),
        new Map([
          [1, 'a'],
          [2, 'b'],
        ])
      )
    ).to.equal(true);
    expect(deepEqual(null, null)).to.equal(true);
    expect(deepEqual(null, {})).to.equal(false);
    expect(deepEqual(new Date(100), new Date(100))).to.equal(true);
    expect(deepEqual(new Date(123), new Date(456))).to.equal(false);
  });

  test('like', () => {
    expect(like('hello world', 'hello%')).to.equal(true);
    expect(like('hello world', 'hello _orld')).to.equal(true);
    expect(like('hello world', '%world')).to.equal(true);
    expect(like('hello world', 'h_llo w_rld')).to.equal(true);
    expect(like('hello world', 'hello%world')).to.equal(true);
    expect(like('hello world', 'hello world')).to.equal(true);
    expect(like('hello world', 'h_llo%world')).to.equal(true);
    expect(like('hellO world', 'H_lLo%wOrld')).to.equal(true);
    expect(like('hello world', 'h_llo %w_rld')).to.equal(true);
    expect(like('hello world', 'hello')).to.equal(false);
    expect(like('hello world', '%llo%')).to.equal(true);
    expect(like('hello world', 'world')).to.equal(false);
    expect(like('hello world', 'h_llo%w_rld!')).to.equal(false);
  });

  test('compare', () => {
    expect(compare(3, 4)).to.equal(-1);
    expect(compare(5, 1)).to.equal(1);
    expect(compare(7, 7)).to.equal(0);
    expect(compare('apple', 'banana')).to.equal(-1);
    expect(compare('cherry', 'apple')).to.equal(1);
    expect(compare('date', 'date')).to.equal(0);
    expect(compare(new Date(200), new Date(200))).to.equal(0);
    expect(compare(new Date(100), new Date(200))).to.equal(-1);
    expect(compare(new Date(200), new Date(100))).to.equal(1);
  });

  test('setPath', () => {
    const cases = [
      {target: {}, path: ['a'], value: 3, expected: {a: 3}},
      {target: {}, path: ['a', 'b'], value: 3, expected: {a: {b: 3}}},
      {target: {a: {}}, path: ['a', 'b'], value: 3, expected: {a: {b: 3}}},
      {
        target: {b: {}},
        path: ['a', 'b'],
        value: 3,
        expected: {b: {}, a: {b: 3}},
      },
    ];

    for (const {target, path, value, expected} of cases) {
      setPath(target, path, value);
      expect(target).to.deep.equal(expected);
    }
  });

  test('deepEntries', () => {
    const cases = [
      {
        target: {a: 1, b: 2},
        expected: [
          [['a'], 1],
          [['b'], 2],
        ],
      },
      {
        target: {a: 1, b: {c: 2}},
        expected: [
          [['a'], 1],
          [['b', 'c'], 2],
        ],
      },
    ];

    for (const {target, expected} of cases) {
      expect(deepEntries(target)).to.deep.equal(expected);
    }
  });

  describe('isNumberString', () => {
    test('should return true for valid integer strings', () => {
      expect(isNumberString('123')).toBe(true);
      expect(isNumberString('-123')).toBe(true);
      expect(isNumberString('+123')).toBe(true);
      expect(isNumberString('0')).toBe(true);
    });

    test('should return true for valid floating-point strings', () => {
      expect(isNumberString('123.456')).toBe(true);
      expect(isNumberString('-123.456')).toBe(true);
      expect(isNumberString('+123.456')).toBe(true);
      expect(isNumberString('0.456')).toBe(true);
    });

    test('should return false for strings with invalid number formats', () => {
      expect(isNumberString('123.')).toBe(false); // Trailing dot
      expect(isNumberString('.456')).toBe(false); // Leading dot
      expect(isNumberString('123..456')).toBe(false); // Multiple dots
      expect(isNumberString('123a')).toBe(false); // Invalid character
      expect(isNumberString('abc')).toBe(false); // Non-numeric string
      expect(isNumberString('')).toBe(false); // Empty string
      expect(isNumberString('+-123')).toBe(false); // Multiple signs
    });

    test('should return false for strings that are not numbers', () => {
      expect(isNumberString(' ')).toBe(false); // Whitespace
      expect(isNumberString('abc123')).toBe(false); // Letters and numbers
      expect(isNumberString('123abc')).toBe(false); // Numbers and letters
      expect(isNumberString('NaN')).toBe(false); // NaN string
      expect(isNumberString('Infinity')).toBe(false); // Infinity string
    });
  });
});
