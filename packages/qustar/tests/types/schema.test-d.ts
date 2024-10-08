// import {describe, test} from 'vitest';
// import {EntityDescriptor} from '../../src/descriptor.js';
// import {Query} from '../../src/index.js';
// import {Expand} from '../../src/types/query.js';
// import {DeriveEntity} from '../../src/types/schema.js';

// declare function derive<const T extends EntityDescriptor>(
//   _: T
// ): Expand<DeriveEntity<T>>;

// // vitest expectTypeOf doesn't work, because DeriveEntity generates too complex type
// declare function check<T>(_: T);

// interface User {
//   id: number;
// }
// declare const users: Query<User>;

// describe('typescript', () => {
//   describe('schema', () => {
//     test('i8', () => {
//       check<{x: number}>(derive({x: 'i8'}));
//       check<{x: number}>(derive<Query.Schema<{x: number}>>({x: 'i8'}));
//       check<{x: number}>(derive({x: {type: 'i8'}}));
//       check<{x: number}>(derive<Query.Schema<{x: number}>>({x: {type: 'i8'}}));
//       check<{x: number}>(derive({x: {type: 'i8', nullable: false}}));
//       check<{x: number}>(
//         derive<Query.Schema<{x: number}>>({x: {type: 'i8', nullable: false}})
//       );
//       check<{x: number | null}>(derive({x: {type: 'i8', nullable: true}}));
//       check<{x: number | null}>(
//         derive<Query.Schema<{x: number | null}>>({
//           x: {type: 'i8', nullable: true},
//         })
//       );
//     });

//     test('i16', () => {
//       check<{x: number}>(derive({x: 'i16'}));
//       check<{x: number}>(derive<Query.Schema<{x: number}>>({x: 'i16'}));
//       check<{x: number}>(derive({x: {type: 'i16'}}));
//       check<{x: number}>(derive<Query.Schema<{x: number}>>({x: {type: 'i16'}}));
//       check<{x: number}>(derive({x: {type: 'i16', nullable: false}}));
//       check<{x: number}>(
//         derive<Query.Schema<{x: number}>>({x: {type: 'i16', nullable: false}})
//       );
//       check<{x: number | null}>(derive({x: {type: 'i16', nullable: true}}));
//       check<{x: number | null}>(
//         derive<Query.Schema<{x: number | null}>>({
//           x: {type: 'i16', nullable: true},
//         })
//       );

//       test('i32', () => {
//         check<{x: number}>(derive({x: 'i32'}));
//         check<{x: number}>(derive<Query.Schema<{x: number}>>({x: 'i32'}));
//         check<{x: number}>(derive({x: {type: 'i32'}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'i32'}})
//         );
//         check<{x: number}>(derive({x: {type: 'i32', nullable: false}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'i32', nullable: false}})
//         );
//         check<{x: number | null}>(derive({x: {type: 'i32', nullable: true}}));
//         check<{x: number | null}>(
//           derive<Query.Schema<{x: number | null}>>({
//             x: {type: 'i32', nullable: true},
//           })
//         );
//       });

//       test('i64', () => {
//         check<{x: number}>(derive({x: 'i64'}));
//         check<{x: number}>(derive<Query.Schema<{x: number}>>({x: 'i64'}));
//         check<{x: number}>(derive({x: {type: 'i64'}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'i64'}})
//         );
//         check<{x: number}>(derive({x: {type: 'i64', nullable: false}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'i64', nullable: false}})
//         );
//         check<{x: number | null}>(derive({x: {type: 'i64', nullable: true}}));
//         check<{x: number | null}>(
//           derive<Query.Schema<{x: number | null}>>({
//             x: {type: 'i64', nullable: true},
//           })
//         );
//       });

//       test('f32', () => {
//         check<{x: number}>(derive({x: 'f32'}));
//         check<{x: number}>(derive<Query.Schema<{x: number}>>({x: 'f32'}));
//         check<{x: number}>(derive({x: {type: 'f32'}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'f32'}})
//         );
//         check<{x: number}>(derive({x: {type: 'f32', nullable: false}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'f32', nullable: false}})
//         );
//         check<{x: number | null}>(derive({x: {type: 'f32', nullable: true}}));
//         check<{x: number | null}>(
//           derive<Query.Schema<{x: number | null}>>({
//             x: {type: 'f32', nullable: true},
//           })
//         );
//       });

//       test('f64', () => {
//         check<{x: number}>(derive({x: 'f64'}));
//         check<{x: number}>(derive<Query.Schema<{x: number}>>({x: 'f64'}));
//         check<{x: number}>(derive({x: {type: 'f64'}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'f64'}})
//         );
//         check<{x: number}>(derive({x: {type: 'f64', nullable: false}}));
//         check<{x: number}>(
//           derive<Query.Schema<{x: number}>>({x: {type: 'f64', nullable: false}})
//         );
//         check<{x: number | null}>(derive({x: {type: 'f64', nullable: true}}));
//         check<{x: number | null}>(
//           derive<Query.Schema<{x: number | null}>>({
//             x: {type: 'f64', nullable: true},
//           })
//         );
//       });

//       test('boolean', () => {
//         check<{x: boolean}>(derive({x: 'boolean'}));
//         check<{x: boolean}>(derive<Query.Schema<{x: boolean}>>({x: 'boolean'}));
//         check<{x: boolean}>(derive({x: {type: 'boolean'}}));
//         check<{x: boolean}>(
//           derive<Query.Schema<{x: boolean}>>({x: {type: 'boolean'}})
//         );
//         check<{x: boolean}>(derive({x: {type: 'boolean', nullable: false}}));
//         check<{x: boolean}>(
//           derive<Query.Schema<{x: boolean}>>({
//             x: {type: 'boolean', nullable: false},
//           })
//         );
//         check<{x: boolean | null}>(
//           derive({x: {type: 'boolean', nullable: true}})
//         );
//         check<{x: boolean | null}>(
//           derive<Query.Schema<{x: boolean | null}>>({
//             x: {type: 'boolean', nullable: true},
//           })
//         );
//       });

//       test('string', () => {
//         check<{x: string}>(derive({x: 'string'}));
//         check<{x: string}>(derive<Query.Schema<{x: string}>>({x: 'string'}));
//         check<{x: string}>(derive({x: {type: 'string'}}));
//         check<{x: string}>(
//           derive<Query.Schema<{x: string}>>({x: {type: 'string'}})
//         );
//         check<{x: string}>(derive({x: {type: 'string', nullable: false}}));
//         check<{x: string}>(
//           derive<Query.Schema<{x: string}>>({
//             x: {type: 'string', nullable: false},
//           })
//         );
//         check<{x: string | null}>(derive({x: {type: 'string', nullable: true}}));
//         check<{x: string | null}>(
//           derive<Query.Schema<{x: string | null}>>({
//             x: {type: 'string', nullable: true},
//           })
//         );
//       });
//     });

//     test('forward ref', () => {
//       check<{x: User}>(
//         derive({
//           x: {
//             type: 'ref',
//             required: true,
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );
//       check<{x: User}>(
//         derive<Query.Schema<{x: User}>>({
//           x: {
//             type: 'ref',
//             required: true,
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );

//       check<{x: User | null}>(
//         derive({
//           x: {
//             type: 'ref',
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );
//       check<{x: User | null}>(
//         derive<Query.Schema<{x: User | null}>>({
//           x: {
//             type: 'ref',
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );

//       check<{x: User | null}>(
//         derive({
//           x: {
//             type: 'ref',
//             required: false,
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );
//       check<{x: User | null}>(
//         derive<Query.Schema<{x: User | null}>>({
//           x: {
//             type: 'ref',
//             required: false,
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );
//     });

//     test('back ref', () => {
//       check<{x: User[]}>(
//         derive({
//           x: {
//             type: 'back_ref',
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );
//       check<{x: User[]}>(
//         derive<Query.Schema<{x: User[]}>>({
//           x: {
//             type: 'back_ref',
//             references: () => users,
//             condition: () => true,
//           },
//         })
//       );
//     });
//   });
// });
