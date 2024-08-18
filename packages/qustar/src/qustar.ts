import {SingleLiteralValue} from './literal';
import {Expr, Expr as OriginalExpr} from './query/expr';
import {Query as OriginalQuery, Query} from './query/query';
import {ValidValue} from './types/query';
import {ValidateEntity} from './types/schema';

type StaticMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

type QueryStaticMethods = StaticMethods<typeof Query>;
type ExprStaticMethods = StaticMethods<typeof Expr>;

export type Qustar = QueryStaticMethods &
  ExprStaticMethods & {
    Query: typeof Query;
    Expr: typeof Expr;
  };

export const Q: Qustar = combineObjects(Query, Expr, {
  Query: Query,
  Expr: Expr,
});

export const Qustar = Q;

export namespace Q {
  export type Schema<T extends ValidateEntity<T>> = Query.Schema<T>;
  export type Infer<T extends Query<any>> = Query.Infer<T>;
  export type Query<T extends ValidValue<T>> = OriginalQuery<T>;
  export type Expr<T extends SingleLiteralValue> = OriginalExpr<T>;
}

function combineObjects(...sources: any[]) {
  const target: any = {};
  sources.forEach(source => {
    Object.getOwnPropertyNames(source).forEach(name => {
      if (typeof source[name] === 'function') {
        target[name] = source[name];
      }
    });
  });

  return target;
}
