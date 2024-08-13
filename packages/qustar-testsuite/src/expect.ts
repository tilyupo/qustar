export function simpleExpectDeepEqual<T>(
  actual: T,
  expected: T,
  message?: string
): void {
  if (!deepEqual(actual, expected)) {
    throw new Error(
      message ||
        `Assertion failed: ${JSON.stringify(actual)} does not deeply equal ${JSON.stringify(expected)}`
    );
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true; // Same object or primitive value
  }

  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false; // One of them is not an object or is null
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false; // One is an array and the other is not
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false; // Different number of keys
  }

  for (const key of keysA) {
    if (!keysB.includes(key)) {
      return false; // Different keys
    }

    if (!deepEqual(a[key], b[key])) {
      return false; // Different values for the same key
    }
  }

  return true;
}
