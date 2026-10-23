import { LangError } from './errors.js';
import { builtin, isNumber, valueType } from './values.js';

function expectNumbers(args, name, node) {
  for (const arg of args) {
    if (!isNumber(arg)) {
      throw new LangError(
        `${name} expects numbers, got a ${valueType(arg)}`,
        node?.line ?? 1,
        node?.col ?? 1,
      );
    }
  }
}

const numeric1 = (name, fn) =>
  builtin(name, 1, ([x], _ctx, node) => {
    expectNumbers([x], name, node);
    return fn(x);
  });

const numeric2 = (name, fn) =>
  builtin(name, 2, ([a, b], _ctx, node) => {
    expectNumbers([a, b], name, node);
    return fn(a, b);
  });

export const builtins = {
  sqrt: numeric1('sqrt', Math.sqrt),
  abs: numeric1('abs', Math.abs),
  floor: numeric1('floor', Math.floor),
  ceil: numeric1('ceil', Math.ceil),
  round: numeric1('round', Math.round),
  min: numeric2('min', Math.min),
  max: numeric2('max', Math.max),
};
