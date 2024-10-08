import {Expr, Q, sql} from 'qustar';
import {comments, users} from '../db.js';
import {SuiteContext} from '../describe.js';
import {ExecuteOptions} from '../utils.js';

export function describeExpr({expectQuery, test, describe}: SuiteContext) {
  describe('expr', () => {
    function testExpr(
      name: string,
      expr: Expr<any>,
      expected: any,
      options?: ExecuteOptions
    ) {
      test(name, async () => {
        const query = users
          .orderByAsc(x => x.id)
          .drop(1)
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

      describe('sub', () => {
        testExpr('2 - 4 is -2', Expr.sub(2, 4), -2);
        testExpr('2.2 - 4 is -1.8', Expr.sub(2.4, 4), -1.6);
        testExpr('2 - null is null', Expr.sub(2, null), null);
        testExpr('null - 2 is null', Expr.sub(null, 2), null);
      });

      describe('mul', () => {
        testExpr('2 * 4 is 8', Expr.mul(2, 4), 8);
        testExpr('2 * 4.2 is 8.4', Expr.mul(2, 4.2), 8.4);
        testExpr('2 * null is null', Expr.mul(2, null), null);
        testExpr('null * 2 is null', Expr.mul(null, 2), null);
      });

      describe('div', () => {
        testExpr('2 / 2 is 1', Expr.div(2, 2), 1);
        testExpr('7 / 2 is 3', Expr.div(7, 2), 3.5);
        testExpr('7.5 / 2 is 3.75', Expr.div(7.5, 2), 3.75);
        testExpr('null / 2 is null', Expr.div(null, 2), null);
        testExpr('7.2 / null is null', Expr.div(7.2, null), null);
      });

      describe('eq', () => {
        testExpr('2 == 2 is true', Expr.eq(2, 2), true);
        testExpr('2 == 5 is false', Expr.eq(2, 5), false);
        testExpr('2 == null is false', Expr.eq(2, null), false);
        testExpr('null == 2 is false', Expr.eq(null, 2), false);
        testExpr('null == null is true', Expr.eq(null, null), true, {
          optOnly: true,
        });
      });

      describe('ne', () => {
        testExpr('2 != 5 is true', Expr.ne(2, 5), true);
        testExpr('2 != 2 is false', Expr.ne(2, 2), false);
        testExpr('2 != null is true', Expr.ne(2, null), true, {
          optOnly: true,
        });
        testExpr("null != 'foo' is true", Expr.ne(null, 'foo'), true, {
          optOnly: true,
        });
        testExpr('null != null is false', Expr.ne(null, null), false, {
          optOnly: true,
        });
      });

      testExpr('true and true is true', Expr.and(true, true), true);
      testExpr('true and false is false', Expr.and(true, false), false);
      testExpr('false and true is false', Expr.and(false, true), false);
      testExpr('false and false is false', Expr.and(false, false), false);
      testExpr('null and true is false', Expr.and(null, true), false);
      testExpr('false and null is false', Expr.and(false, null), false);
      testExpr('true and null is false', Expr.and(true, null), false);
      testExpr('null and false is false', Expr.and(null, false), false);
      testExpr('null and null is null', Expr.and(null, null), false);

      testExpr('true or true is true', Expr.or(true, true), true);
      testExpr('true or false is true', Expr.or(true, false), true);
      testExpr('false or true is true', Expr.or(false, true), true);
      testExpr('false or false is false', Expr.or(false, false), false);
      testExpr('null or true is true', Expr.or(null, true), true);
      testExpr('false or null is false', Expr.or(false, null), false);
      testExpr('true or null is true', Expr.or(true, null), true);
      testExpr('null or false is false', Expr.or(null, false), false);
      testExpr('null or null is false', Expr.or(null, false), false);

      describe('gt', () => {
        testExpr('0 > 1 is false', Expr.gt(0, 1), false);
        testExpr('1 > 1 is false', Expr.gt(1, 1), false);
        testExpr('2 > 1 is true', Expr.gt(2, 1), true);
        testExpr('null > 1 is false', Expr.gt(null, 1), false);
        testExpr('2 > null is false', Expr.gt(2, null), false);
      });

      describe('lt', () => {
        testExpr('0 < 1 is 0', Expr.lt(0, 1), true);
        testExpr('1 < 1 is 0', Expr.lt(1, 1), false);
        testExpr('2 < 1 is 0', Expr.lt(2, 1), false);
        testExpr('null < 1 is false', Expr.lt(null, 1), false);
        testExpr('2 < null is false', Expr.lt(2, null), false);
      });

      describe('lte', () => {
        testExpr('0 <= 1 is 1', Expr.lte(0, 1), true);
        testExpr('1 <= 1 is 1', Expr.lte(1, 1), true);
        testExpr('2 <= 1 is 0', Expr.lte(2, 1), false);
        testExpr('null <= 1 is false', Expr.lte(null, 1), false);
        testExpr('2 <= null is false', Expr.lte(2, null), false);
      });

      describe('gte', () => {
        testExpr('0 >= 1 is 1', Expr.gte(0, 1), false);
        testExpr('1 >= 1 is 1', Expr.gte(1, 1), true);
        testExpr('2 >= 1 is 0', Expr.gte(2, 1), true);
        testExpr('null >= 1 is false', Expr.gte(null, 1), false);
        testExpr('2 >= null is false', Expr.gte(2, null), false);
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
      testExpr('-1 is -1', Expr.negate(1), -1);
      testExpr('-(-1) is 1', Expr.negate(-1), 1);
      testExpr('-null is null', Expr.negate(null), null, {
        optOnly: true,
      });

      testExpr('!true is false', Expr.not(true), false);
      testExpr('!false is true', Expr.not(false), true);
      testExpr('!null is true', Expr.not(null), true, {optOnly: true});
    });

    describe('sql', () => {
      testExpr('1 + 1', Q.rawExpr({sql: sql`1 + 1`, schema: Q.i32()}), 2);
      testExpr(
        '1 + NULL',
        Q.rawExpr({sql: sql`1 + NULL`, schema: Q.i32().null()}),
        null
      );
      testExpr('1 + ?', Q.rawExpr({sql: sql`1 + ${2}`, schema: Q.i32()}), 3);
      testExpr(
        'SELECT 2',
        Expr.rawExpr({sql: sql`SELECT ${2}`, schema: Q.i32()}),
        2
      );

      test('${comments.id} + 1', async () => {
        const query = comments
          .map(x => Expr.rawExpr({sql: sql`${x.id} + 1`, schema: Q.i32()}))
          .orderByAsc(x => x);

        await expectQuery(query, [6, 7, 8, 9]);
      });
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
    });

    describe('literal', () => {
      // todo: add date, time, timetz, timestamp, timestamptz, uuid
      testExpr('1 is 1', Expr.from(1), 1);
      testExpr("'one' is 'one'", Expr.from('one'), 'one');
      testExpr('"\'` is "\'`', Expr.from('"\'`'), '"\'`');
      testExpr('null is null', Expr.from(null), null);
      testExpr('1.23 is 1.23', Expr.from(1.23), 1.23);
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

      describe('toLowerCase', () => {
        testExpr(
          'TypeScript is typescript',
          Expr.toLowerCase(Expr.from('TypeScript')),
          'typescript'
        );
        testExpr(
          'lower is lower',
          Expr.toLowerCase(Expr.from('lower')),
          'lower'
        );
        testExpr(
          'UPPER is upper',
          Expr.toLowerCase(Expr.from('UPPER')),
          'upper'
        );
        testExpr('null is null', Expr.toLowerCase(Expr.from(null)), null);
      });

      describe('toUpperCase', () => {
        testExpr(
          'TypeScript is TYPESCRIPT',
          Expr.toUpperCase(Expr.from('TypeScript')),
          'TYPESCRIPT'
        );
        testExpr(
          'lower is LOWER',
          Expr.toUpperCase(Expr.from('lower')),
          'LOWER'
        );
        testExpr(
          'UPPER is UPPER',
          Expr.toUpperCase(Expr.from('UPPER')),
          'UPPER'
        );
        testExpr('null is null', Expr.toUpperCase(Expr.from(null)), null);
      });

      describe('toString', () => {
        testExpr('toString(null) is null', Expr.from(null).toString(), null);
        // todo: add new Date() toString test
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
        testExpr('toInt(1234) is 1234', Expr.from(1234).toInt(), 1234);
        testExpr('toInt(234.456) is 234', Expr.from(234.456).toInt(), 234);
        testExpr('toInt(true) is 1', Expr.from(true).toInt(), 1);
        testExpr('toInt(false) is 0', Expr.from(false).toInt(), 0);
      });

      describe('toFloat', () => {
        testExpr('toFloat(null) is null', Expr.from(null).toFloat(), null);
        testExpr("toFloat('1234') is 1234", Expr.from('1234').toFloat(), 1234);
        testExpr(
          "toFloat('234.567') is 234.567",
          Expr.from('234.567').toFloat(),
          234.567
        );
        testExpr('toFloat(1234) is 1234', Expr.from(1234).toFloat(), 1234);
        testExpr(
          'toFloat(234.567) is 234.567',
          Expr.from(234.567).toFloat(),
          234.567
        );
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
