import {ArrayLiteralValue, SingleLiteralValue} from '../literal.js';
import {SingleScalarOperand} from './expr.js';
import {SqlTemplate} from './schema.js';

export function sql(
  src: TemplateStringsArray,
  ...args: Array<SingleScalarOperand<SingleLiteralValue> | ArrayLiteralValue>
): SqlTemplate {
  return {src, args};
}
