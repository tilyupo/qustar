import {describe, expect, it} from 'vitest';
import {simpleExpectDeepEqual} from '../src/expect.js';

describe('assertDeepEqual', () => {
  it('should not throw an error for deeply equal primitives', () => {
    expect(() => simpleExpectDeepEqual(1, 1)).not.toThrow();
    expect(() => simpleExpectDeepEqual('hello', 'hello')).not.toThrow();
    expect(() => simpleExpectDeepEqual(true, true)).not.toThrow();
  });

  it('should throw an error for non-equal primitives', () => {
    expect(() => simpleExpectDeepEqual(1, 2)).toThrow();
    expect(() => simpleExpectDeepEqual('hello', 'world')).toThrow();
    expect(() => simpleExpectDeepEqual(true, false)).toThrow();
  });

  it('should not throw an error for deeply equal objects', () => {
    expect(() =>
      simpleExpectDeepEqual({a: 1, b: 2}, {a: 1, b: 2})
    ).not.toThrow();
    expect(() => simpleExpectDeepEqual({a: {b: 2}}, {a: {b: 2}})).not.toThrow();
  });

  it('should throw an error for non-equal objects', () => {
    expect(() => simpleExpectDeepEqual({a: 1, b: 2}, {a: 1, b: 3})).toThrow();
    expect(() => simpleExpectDeepEqual({a: {b: 2}}, {a: {b: 3}})).toThrow();
  });

  it('should not throw an error for deeply equal arrays', () => {
    expect(() => simpleExpectDeepEqual([1, 2, 3], [1, 2, 3])).not.toThrow();
    expect(() => simpleExpectDeepEqual([1, [2, 3]], [1, [2, 3]])).not.toThrow();
  });

  it('should throw an error for non-equal arrays', () => {
    expect(() => simpleExpectDeepEqual([1, 2, 3], [1, 2, 4])).toThrow();
    expect(() => simpleExpectDeepEqual([1, [2, 3]], [1, [2, 4]])).toThrow();
  });

  it('should not throw an error for deeply equal mixed objects and arrays', () => {
    expect(() =>
      simpleExpectDeepEqual({a: [1, 2], b: {c: 3}}, {a: [1, 2], b: {c: 3}})
    ).not.toThrow();
  });

  it('should throw an error for non-equal mixed objects and arrays', () => {
    expect(() =>
      simpleExpectDeepEqual({a: [1, 2], b: {c: 3}}, {a: [1, 2], b: {c: 4}})
    ).toThrow();
  });

  it('should correctly handle null and undefined', () => {
    expect(() => simpleExpectDeepEqual(null, null)).not.toThrow();
    expect(() => simpleExpectDeepEqual(undefined, undefined)).not.toThrow();
    expect(() => simpleExpectDeepEqual(null, undefined)).toThrow();
    expect(() => simpleExpectDeepEqual({a: null}, {a: null})).not.toThrow();
    expect(() =>
      simpleExpectDeepEqual({a: undefined}, {a: undefined})
    ).not.toThrow();
    expect(() => simpleExpectDeepEqual({a: null}, {a: undefined})).toThrow();
  });

  it('should correctly compare nested structures', () => {
    const obj1 = {a: {b: {c: [1, 2, 3]}}};
    const obj2 = {a: {b: {c: [1, 2, 3]}}};
    expect(() => simpleExpectDeepEqual(obj1, obj2)).not.toThrow();
  });

  it('should throw an error with a custom message', () => {
    const customMessage = 'Custom assertion error';
    expect(() => simpleExpectDeepEqual(1, 2, customMessage)).toThrow(
      customMessage
    );
  });
});
