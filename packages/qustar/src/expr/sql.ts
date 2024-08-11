import {ArrayLiteralValue, SingleLiteralValue} from '../literal.js';
import {ScalarOperand} from './expr.js';
import {SqlTemplate} from './schema.js';

export function sql(
  src: TemplateStringsArray,
  ...args: Array<ScalarOperand<SingleLiteralValue> | ArrayLiteralValue>
): SqlTemplate {
  return {src, args};
}
