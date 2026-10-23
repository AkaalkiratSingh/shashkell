export function createEnv(parent = null) {
  return { parent, vars: new Map() };
}

export function envDefine(env, name, value) {
  env.vars.set(name, value);
}

export function envLookup(env, name) {
  let scope = env;
  while (scope) {
    if (scope.vars.has(name)) return scope.vars.get(name);
    scope = scope.parent;
  }
  return undefined;
}

export const tuple = (items) => ({ type: 'tuple', items });
export const closure = (params, body, env) => ({ type: 'closure', params, body, env });
export const builtin = (name, arity, fn, args = []) => ({ type: 'builtin', name, arity, fn, args });

export const isNumber = (v) => typeof v === 'number';
export const isBoolean = (v) => typeof v === 'boolean';
export const isTuple = (v) => typeof v === 'object' && v !== null && v.type === 'tuple';
export const isImage = (v) => typeof v === 'object' && v !== null && v.type === 'image';
export const isCallable = (v) =>
  typeof v === 'object' && v !== null && (v.type === 'closure' || v.type === 'builtin');

export const SWIZZLE_COMPONENTS = {
  x: 0,
  y: 1,
  z: 2,
  w: 3,
  r: 0,
  g: 1,
  b: 2,
  a: 3,
};

export function valueType(v) {
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (v === null || v === undefined) return 'nothing';
  if (v.type === 'tuple') return 'tuple';
  if (v.type === 'closure') return 'function';
  if (v.type === 'builtin') return 'builtin';
  if (v.type === 'image') return 'image';
  return 'value';
}

export function formatValue(v) {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return String(v);
  if (v && v.type === 'tuple') return `(${v.items.map(formatValue).join(', ')})`;
  if (v && v.type === 'closure') return '<function>';
  if (v && v.type === 'builtin') return `<builtin ${v.name}>`;
  if (v && v.type === 'image') return `<image ${v.width}x${v.height}>`;
  return String(v);
}
