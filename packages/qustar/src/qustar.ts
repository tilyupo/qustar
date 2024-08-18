import {Prop as OriginalProp, Prop} from './descriptor';
import {SingleLiteralValue} from './literal';
import {Expr, Expr as OriginalExpr} from './query/expr';
import {Query as OriginalQuery, Query} from './query/query';
import {ValidValue} from './types/query';

type StaticMethods<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? T[K] : never;
};

type QueryStaticMethods = StaticMethods<typeof Query>;
type ExprStaticMethods = StaticMethods<typeof Expr>;
type PropStaticMethods = StaticMethods<typeof Prop>;

export type Qustar = QueryStaticMethods &
  PropStaticMethods &
  ExprStaticMethods & {
    Query: typeof Query;
    Expr: typeof Expr;
    Prop: typeof Prop;
  };

export const Q: Qustar = combineObjects(Query, Expr, Prop, {
  Query: Query,
  Expr: Expr,
  Prop: Prop,
});

export const Qustar = Q;

export namespace Q {
  export type Schema<T extends object> = Query.Schema<T>;
  export type Infer<T extends Query<any>> = Query.Infer<T>;
  export type Query<T extends ValidValue<T>> = OriginalQuery<T>;
  export type Expr<T extends SingleLiteralValue> = OriginalExpr<T>;
  export type Prop<
    TType,
    TIsGenerated extends boolean,
    TIsRef extends boolean,
  > = OriginalProp<TType, TIsGenerated, TIsRef>;
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
