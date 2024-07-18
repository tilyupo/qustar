import {Expr, SingleLiteralValue} from 'qustar';
import {SuiteContext} from '../index.js';
import {ExecuteOptions} from '../utils.js';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function describeExpr({expectQuery, test, describe}: SuiteContext) {
  describe('expr', () => {
    function testExpr<T extends SingleLiteralValue>(
      name: string,
      expr: Expr<T>,
      expected: any,
      options?: ExecuteOptions
    ) {
      test(name, async ({users}) => {
        const query = users
          .orderByAsc(x => x.id)
          .offset(1)
          .limit(1)
          .map(() => expr);

        await expectQuery(query, [expected], options);
      });
    }

    describe('binary', () => {
      testExpr('2 + 4 is 6', Expr.add(2, 4), 6);
      testExpr('2 + 4.2 is 6.2', Expr.add(2, 4.2), 6.2);
      testExpr('2 + null is null', Expr.add(2, null), null);
      testExpr('null + 2 is null', Expr.add(null, 2), null);

      (['sub', 'subtract'] as const).forEach(method => {
        describe(method, () => {
          testExpr('2 - 4 is -2', Expr[method](2, 4), -2);
          testExpr('2.2 - 4 is -1.8', Expr[method](2.4, 4), -1.6);
          testExpr('2 - null is null', Expr[method](2, null), null);
          testExpr('null - 2 is null', Expr[method](null, 2), null);
        });
      });

      (['mul', 'multiply'] as const).forEach(method => {
        describe(method, () => {
          testExpr('2 * 4 is 8', Expr[method](2, 4), 8);
          testExpr('2 * 4.2 is 8.4', Expr[method](2, 4.2), 8.4);
          testExpr('2 * null is null', Expr[method](2, null), null);
          testExpr('null * 2 is null', Expr[method](null, 2), null);
        });
      });

      (['div', 'divide'] as const).forEach(method => {
        describe(method, () => {
          testExpr('2 / 2 is 1', Expr[method](2, 2), 1);
          testExpr('7 / 2 is 3', Expr[method](7, 2), 3);
          testExpr('7.2 / 2 is 3.6', Expr[method](7.2, 2), 3.6);
          testExpr('null / 2 is null', Expr[method](null, 2), null);
          testExpr('7.2 / null is null', Expr[method](7.2, null), null);
        });
      });

      (['eq', 'equals'] as const).forEach(method => {
        describe(method, () => {
          testExpr("2 == '2' is true", Expr[method](2, '2' as any), false);
          testExpr('2 == 2 is true', Expr[method](2, 2), true);
          testExpr('2 == 5 is false', Expr[method](2, 5), false);
          testExpr('2 == null is false', Expr[method](2, null), false);
          testExpr('null == 2 is false', Expr[method](null, 2), false);
          testExpr('null == null is true', Expr[method](null, null), true);
        });
      });

      (['ne', 'notEquals'] as const).forEach(method => {
        describe(method, () => {
          testExpr('2 != 5 is true', Expr[method](2, 5), true);
          testExpr('2 != 2 is false', Expr[method](2, 2), false);
          testExpr('2 != null is true', Expr[method](2, null), true);
          testExpr("null != 'foo' is true", Expr[method](null, 'foo'), true);
          testExpr('null != null is false', Expr[method](null, null), false);
        });
      });

      (['shl', 'shiftLeft'] as const).forEach(method => {
        describe(method, () => {
          testExpr('0 << 3 is 16', Expr[method](0, 3), 0);
          testExpr('2 << 3 is 16', Expr[method](2, 3), 16);
          testExpr('null << 3 is null', Expr[method](null, 3), null);
          testExpr('2 << null is null', Expr[method](2, null), null);
        });
      });

      (['shr', 'shiftRight'] as const).forEach(method => {
        describe(method, () => {
          testExpr('2 >> 1 is 1', Expr[method](2, 1), 1);
          testExpr('7 >> 1 is 2', Expr[method](7, 1), 3);
          testExpr('null >> 1 is null', Expr[method](null, 2), null);
          testExpr('7 >> null is null', Expr[method](6, null), null);
        });
      });

      testExpr('2 & 7 is 2', Expr.bitwiseAnd(2, 7), 2);
      testExpr('3 & 5 is 1', Expr.bitwiseAnd(3, 5), 1);
      testExpr('2 & null is null', Expr.bitwiseAnd(2, null), null);
      testExpr('null & 5 is null', Expr.bitwiseAnd(null, 5), null);

      testExpr('2 | 1 is 3', Expr.bitwiseOr(2, 1), 3);
      testExpr('5 | 3 is 7', Expr.bitwiseOr(5, 3), 7);
      testExpr('null | 1 is null', Expr.bitwiseOr(null, 1), null);
      testExpr('5 | null is null', Expr.bitwiseOr(5, null), null);

      testExpr('2 ^ 1 is 3', Expr.bitwiseXor(2, 1), 3);
      testExpr('2 ^ 4 is 6', Expr.bitwiseXor(2, 4), 6);
      testExpr('null ^ 1 is null', Expr.bitwiseXor(null, 1), null);
      testExpr('2 ^ null is null', Expr.bitwiseXor(2, null), null);

      testExpr('true and true is true', Expr.and(true, true), true);
      testExpr('true and false is false', Expr.and(true, false), false);
      testExpr('false and true is false', Expr.and(false, true), false);
      testExpr('false and false is false', Expr.and(false, false), false);
      testExpr('null and true is false', Expr.and(null, true), false);
      testExpr('false and null is false', Expr.and(false, null), false);
      testExpr('true and null is false', Expr.and(true, null), false);
      testExpr('null and false is false', Expr.and(null, false), false);

      testExpr('true or true is true', Expr.or(true, true), true);
      testExpr('true or false is true', Expr.or(true, false), true);
      testExpr('false or true is true', Expr.or(false, true), true);
      testExpr('false or false is false', Expr.or(false, false), false);
      testExpr('null or true is true', Expr.or(null, true), true);
      testExpr('false or null is false', Expr.or(false, null), false);
      testExpr('true or null is true', Expr.or(true, null), true);
      testExpr('null or false is false', Expr.or(null, false), false);

      (['gt', 'greaterThan'] as const).forEach(method => {
        describe(method, () => {
          testExpr('0 > 1 is false', Expr[method](0, 1), false);
          testExpr('1 > 1 is false', Expr[method](1, 1), false);
          testExpr('2 > 1 is true', Expr[method](2, 1), true);
          testExpr('null > 1 is false', Expr[method](null, 1), false);
          testExpr('2 > null is false', Expr[method](2, null), false);
        });
      });

      (['lt', 'lessThan'] as const).forEach(method => {
        describe(method, () => {
          testExpr('0 < 1 is 0', Expr[method](0, 1), true);
          testExpr('1 < 1 is 0', Expr[method](1, 1), false);
          testExpr('2 < 1 is 0', Expr[method](2, 1), false);
          testExpr('null < 1 is false', Expr[method](null, 1), false);
          testExpr('2 < null is false', Expr[method](2, null), false);
        });
      });

      (['lte', 'lessThanOrEqualTo'] as const).forEach(method => {
        describe(method, () => {
          testExpr('0 <= 1 is 1', Expr[method](0, 1), true);
          testExpr('1 <= 1 is 1', Expr[method](1, 1), true);
          testExpr('2 <= 1 is 0', Expr[method](2, 1), false);
          testExpr('null <= 1 is false', Expr[method](null, 1), false);
          testExpr('2 <= null is false', Expr[method](2, null), false);
        });
      });

      (['gte', 'greaterThanOrEqualTo'] as const).forEach(method => {
        describe(method, () => {
          testExpr('0 >= 1 is 1', Expr[method](0, 1), false);
          testExpr('1 >= 1 is 1', Expr[method](1, 1), true);
          testExpr('2 >= 1 is 0', Expr[method](2, 1), true);
          testExpr('null >= 1 is false', Expr[method](null, 1), false);
          testExpr('2 >= null is false', Expr[method](2, null), false);
        });
      });

      testExpr("'123' like '12%' is 1", Expr.like('123', '12%'), true);
      testExpr("'123' like '12' is 0", Expr.like('123', '12'), false);
      testExpr("null like '12%' is 0", Expr.like(null, '12%'), false);
      testExpr("'123' like null is 0", Expr.like('123', null), false);

      testExpr('1 in (1, 2, 3) is 1', Expr.in(1, [1, 2, 3]), true);
      testExpr('1 in (2, 3) is 0', Expr.in(1, [2, 3]), false);
      testExpr('null in (1, 2, 3) is 0', Expr.in(null, [1, 2, 3]), false);
    });

    describe('unary', () => {
      testExpr('+1 is 1', Expr.plus(1), 1);
      testExpr('+(-1) is -1', Expr.plus(-1), -1);
      testExpr('+null is null', Expr.plus(null), null);

      testExpr('-1 is -1', Expr.minus(1), -1);
      testExpr('-(-1) is 1', Expr.minus(-1), 1);
      testExpr('-null is null', Expr.minus(null), null);

      testExpr('!true is false', Expr.not(true), false);
      testExpr('!false is true', Expr.not(false), true);
      testExpr('!null is true', Expr.not(null), true);

      testExpr('~2 is -3', Expr.bitwiseNot(2), -3);
      testExpr('~-12 is 11', Expr.bitwiseNot(-12), 11);
      testExpr('~null is null', Expr.bitwiseNot(null), null);
    });

    describe('sql', () => {
      testExpr('1 + 1', Expr.sql('1 + 1'), 2);
      testExpr('1 + ?', Expr.sql('1 + ?', 2), 3);
      testExpr('SELECT 1', Expr.sql('SELECT ?', 2), 2);
    });

    describe('case', () => {
      testExpr(
        "case 1 when 1 then 'one' when 2 then 'two' end is 'one'",
        Expr.case(1, [
          {condition: 1, result: 'one'},
          {condition: 2, result: 'two'},
        ]),
        'one'
      );

      testExpr(
        "case 2 when 1 then 'one' when 2 then 'two' end is 'two'",
        Expr.case(2, [
          {condition: 1, result: 'one'},
          {condition: 2, result: 'two'},
        ]),
        'two'
      );

      testExpr(
        "case 3 when 1 then 'one' when 2 then 'two' else 'none' end is 'none'",
        Expr.case(
          3,
          [
            {condition: 1, result: 'one'},
            {condition: 2, result: 'two'},
          ],
          'none'
        ),
        'none'
      );

      testExpr(
        "1 <= 2 ? 'true' : 'false' is 'true'",
        Expr.ternary(Expr.lte(1, 2), 'true', 'false'),
        'true'
      );

      testExpr(
        "1 >= 2 ? 'true' : 'false' is 'false'",
        Expr.ternary(Expr.gte(1, 2), 'true', 'false'),
        'false'
      );
    });

    describe('literal', () => {
      testExpr('1 is 1', Expr.from(1), 1);
      testExpr("'one' is 'one'", Expr.from('one'), 'one');
      testExpr('null is null', Expr.from(null), null);
      testExpr('1.23 is 1.23', Expr.from(1.23), 1.23);
      const now = new Date();
      testExpr('today is today', Expr.from(now), formatDate(now));
      testExpr('true is true', Expr.from(true), true);
      testExpr('false is false', Expr.from(false), false);
    });

    describe('func', () => {
      describe('substring', () => {
        testExpr(
          "substring('01234', 1, 3) is '12'",
          Expr.substring(Expr.from('01234'), 1, 3),
          '12'
        );
        testExpr(
          "substring(null, 1, 3) is '12'",
          Expr.substring(null, 1, 3),
          null
        );
        testExpr(
          "substring('01234', null, 3) is null",
          Expr.substring(Expr.from('01234'), null, 3),
          null
        );
        testExpr(
          "substring('01234', 1, null) is null",
          Expr.substring(Expr.from('01234'), 1, null),
          null
        );
      });

      describe('toString', () => {
        testExpr('toString(null) is null', Expr.from(null).toString(), null);
        testExpr(
          "toString('some text') is 'some text'",
          Expr.from('some text').toString(),
          'some text'
        );
        testExpr(
          "toString(1234) is '1234'",
          Expr.from(1234).toString(),
          '1234'
        );
        testExpr(
          "toString(true) is 'true'",
          Expr.from(true).toString(),
          'true'
        );
        testExpr(
          "toString(false) is 'false'",
          Expr.from(false).toString(),
          'false'
        );
      });

      describe('toInt', () => {
        testExpr('toInt(null) is null', Expr.from(null).toInt(), null);
        testExpr("toInt('1234') is 1234", Expr.from('1234').toInt(), 1234);
        testExpr(
          "toInt('1234suffix') is 1234",
          Expr.from('1234suffix').toInt(),
          1234
        );
        testExpr(
          "toInt('prefix1234') is 0",
          Expr.from('prefix1234').toInt(),
          0
        );
        testExpr("toInt('') is 0", Expr.from('').toInt(), 0);
        testExpr('toInt(1234) is 1234', Expr.from(1234).toInt(), 1234);
        testExpr('toInt(true) is 1', Expr.from(true).toInt(), 1);
        testExpr('toInt(false) is 0', Expr.from(false).toInt(), 0);
      });
    });

    describe('composition', () => {
      testExpr('(3 + 6) / 3 is 3', Expr.div(Expr.add(3, 6), 3), 3);
      testExpr(
        '1 >= 2 and 4 == 4 is false',
        Expr.and(Expr.gte(1, 2), Expr.eq(4, 4)),
        false
      );
      testExpr(
        '1 <= 2 and 4 == 4 is false',
        Expr.and(Expr.lte(1, 2), Expr.eq(4, 4)),
        true
      );
      testExpr(
        '1 >= 2 or 4 == 4 is false',
        Expr.or(Expr.gte(1, 2), Expr.eq(4, 4)),
        true
      );
    });
  });
}
