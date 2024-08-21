import {
  ArrayLiteralValue,
  SingleLiteralValue,
  SingleScalarType,
} from '../literal.js';
import {JoinFilterFn} from '../types/query.js';
import {SingleScalarOperand} from './expr.js';
import {Query} from './query.js';

export interface Field {
  readonly scalarType: SingleScalarType;
  readonly name: string;
  readonly isGenerated: boolean;
}

export interface Schema {
  readonly fields: readonly Field[];
  readonly refs: readonly Ref[];
}

export interface SqlTemplate {
  readonly src: TemplateStringsArray;
  readonly args: Array<
    SingleScalarOperand<SingleLiteralValue> | ArrayLiteralValue
  >;
}

export namespace SqlTemplate {
  export function derive(sql: SqlTemplate | string): SqlTemplate {
    if (typeof sql === 'string') {
      return {
        src: Object.freeze({
          ...[sql],
          raw: [sql],
        }),
        args: [],
      };
    } else {
      return sql;
    }
  }
}

export interface GenericRef<TType extends string> {
  readonly type: TType;
  // todo: remove old comment below, for now refactoring is in progress
  // ref is always defined at root (so path length always
  // equals to one) but when using wildcard projections it
  // can migrate to a nested object. In that case condition
  // should be called with nested object as a handle
  readonly name: string;

  readonly child: () => Query<any>;
  readonly parent: () => Query<any>;

  readonly condition: JoinFilterFn<any, any>;
}

export interface ForwardRef extends GenericRef<'forward_ref'> {
  readonly nullable: boolean;
}

export interface BackRef extends GenericRef<'back_ref'> {
  readonly nullable: false;
}

export type Ref = ForwardRef | BackRef;
