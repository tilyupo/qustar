import {isObject, isPrimitive} from './literal.js';

export function assertNever(x: never, message: string): never {
  throw new Error(message + ' | ' + x);
}

export function assert(
  condition: boolean,
  message?: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function debugFmt(obj: any) {
  return obj.toString();
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function indent(s: string, depth = 1): string {
  return s
    .split('\n')
    .map(x => '  '.repeat(depth) + x)
    .join('\n');
}

export function uniqueBy<TItem, TKey>(
  items: readonly TItem[],
  selector: (x: TItem) => TKey
): TItem[] {
  const keys = new Set();
  const result: TItem[] = [];
  for (const item of items) {
    const key = selector(item);
    if (!keys.has(key)) {
      keys.add(key);
      result.push(item);
    }
  }

  return result;
}

export function compose(): <T>(input: T) => T;
export function compose<A, T>(fn1: (arg: A) => T): (arg: A) => T;
export function compose<A, B, T>(
  fn1: (arg: A) => B,
  fn2: (arg: B) => T
): (arg: A) => T;
export function compose<A, B, C, T>(
  fn1: (arg: A) => B,
  fn2: (arg: B) => C,
  fn3: (arg: C) => T
): (arg: A) => T;

export function compose(...fns: Function[]) {
  if (fns.length === 0) {
    return <T>(input: T) => input;
  }
  if (fns.length === 1) {
    return fns[0];
  }
  return fns.reverse().reduce(
    (prevFn, nextFn) =>
      (...args: any[]) =>
        prevFn(nextFn(...args))
  );
}

export function arrayEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

export function startsWith(a: string[], prefix: string[]): boolean {
  if (prefix.length > a.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i += 1) {
    if (a[i] !== prefix[i]) {
      return false;
    }
  }

  return true;
}

export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false;
  }

  if (a.constructor !== b.constructor) {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }
    for (const value of a) {
      if (!b.has(value)) {
        return false;
      }
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

export function like(str: string, pattern: string): boolean {
  // Escape special characters in the pattern for regex
  let regexPattern = pattern.replace(/([.+?^=!:${}()|[\]/\\])/g, '\\$1');

  // Replace SQL wildcards with regex wildcards
  regexPattern = regexPattern.replace(/%/g, '.*').replace(/_/g, '.');

  // Create a new regex from the modified pattern
  const regex = new RegExp(`^${regexPattern}$`, 'i');

  // Test the string against the regex
  return regex.test(str);
}

export function compare<T>(a: T, b: T): number {
  if (a === b) {
    return 0;
  }

  if (
    (typeof a === 'number' || typeof a === 'boolean') &&
    (typeof b === 'number' || typeof b === 'boolean')
  ) {
    return a > b ? 1 : -1;
  }

  if (typeof a === 'string' && typeof b === 'string') {
    return a > b ? 1 : -1;
  }

  if (a instanceof Date && b instanceof Date) {
    return compare(a.getTime(), b.getTime());
  }

  throw new Error(`Unsupported comparison types: ${a} <=> ${b}`);
}

export function setPath(obj: object, path: string[], value: unknown): void {
  let rollingObj: any = obj;
  for (const part of path.slice(0, -1)) {
    if (!(part in rollingObj)) {
      rollingObj[part] = {};
    }

    rollingObj = rollingObj[part];
  }

  const lastPart = path[path.length - 1];
  rollingObj[lastPart] = value;
}

export type DeepObjectEntry = [path: string[], value: unknown];

export function deepEntries(obj: object): DeepObjectEntry[] {
  if (!isObject(obj)) {
    throw new Error('invalid object: ' + obj);
  }

  const result: DeepObjectEntry[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof key === 'symbol') {
      throw new Error('invalid deep entry key: ' + key);
    }
    if (isObject(value)) {
      result.push(
        ...deepEntries(value).map(
          ([path, value]): DeepObjectEntry => [[key, ...path], value]
        )
      );
    } else if (isPrimitive(value)) {
      result.push([[key], value]);
    } else {
      throw new Error('invalid value: ' + value);
    }
  }

  return result;
}

export function isNumberString(value: string) {
  return /^(-|\+)?[0-9]+(\.[0-9]+)?$/.test(value);
}
