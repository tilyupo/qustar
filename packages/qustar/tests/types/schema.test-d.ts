import {describe, test} from 'vitest';
import {EntityDescriptor} from '../../src/descriptor.js';
import {Expand} from '../../src/types/query.js';
import {DeriveEntity} from '../../src/types/schema.js';

function schema<const T extends EntityDescriptor>(
  _: T
): Expand<DeriveEntity<T>> {
  throw 'unimplemented';
}

// vitest expectTypeOf doesn't work, because DeriveEntity generates too complex type
function check<T>(_: T) {}

describe('typescript', () => {
  test('schema', () => {
    test('primitives', () => {
      check<{x: number}>(schema({x: 'i8'}));
      check<{x: number}>(schema({x: 'i16'}));
      check<{x: number}>(schema({x: 'i32'}));
      check<{x: number}>(schema({x: 'i64'}));
      check<{x: number}>(schema({x: 'f32'}));
      check<{x: number}>(schema({x: 'f64'}));
      check<{x: boolean}>(schema({x: 'boolean'}));
      check<{x: string}>(schema({x: 'text'}));

      check<{x: number}>(schema({x: {type: 'i8'}}));
      check<{x: number}>(schema({x: {type: 'i16'}}));
      check<{x: number}>(schema({x: {type: 'i32'}}));
      check<{x: number}>(schema({x: {type: 'i64'}}));
      check<{x: number}>(schema({x: {type: 'f32'}}));
      check<{x: number}>(schema({x: {type: 'f64'}}));
      check<{x: boolean}>(schema({x: {type: 'boolean'}}));
      check<{x: string}>(schema({x: {type: 'text'}}));

      check<{x: number}>(schema({x: {type: 'i8', nullable: false}}));
      check<{x: number}>(schema({x: {type: 'i16', nullable: false}}));
      check<{x: number}>(schema({x: {type: 'i32', nullable: false}}));
      check<{x: number}>(schema({x: {type: 'i64', nullable: false}}));
      check<{x: number}>(schema({x: {type: 'f32', nullable: false}}));
      check<{x: number}>(schema({x: {type: 'f64', nullable: false}}));
      check<{x: boolean}>(schema({x: {type: 'boolean', nullable: false}}));
      check<{x: string}>(schema({x: {type: 'text', nullable: false}}));

      check<{x: number | null}>(schema({x: {type: 'i8', nullable: true}}));
      check<{x: number | null}>(schema({x: {type: 'i16', nullable: true}}));
      check<{x: number | null}>(schema({x: {type: 'i32', nullable: true}}));
      check<{x: number | null}>(schema({x: {type: 'i64', nullable: true}}));
      check<{x: number | null}>(schema({x: {type: 'f32', nullable: true}}));
      check<{x: number | null}>(schema({x: {type: 'f64', nullable: true}}));
      check<{x: boolean | null}>(
        schema({x: {type: 'boolean', nullable: true}})
      );
      check<{x: string | null}>(schema({x: {type: 'text', nullable: true}}));
    });
  });
});
