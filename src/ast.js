export const Num = (value) => ({ type: 'Num', value });
export const Color = (value) => ({ type: 'Color', value });
export const Bool = (value) => ({ type: 'Bool', value });
export const Var = (name) => ({ type: 'Var', name });
export const Lambda = (params, body) => ({ type: 'Lambda', params, body });
export const App = (fn, arg) => ({ type: 'App', fn, arg });
export const UnaryOp = (op, operand) => ({ type: 'UnaryOp', op, operand });
export const BinOp = (op, left, right) => ({ type: 'BinOp', op, left, right });
export const If = (cond, then, alt) => ({ type: 'If', cond, then, alt });
export const Let = (name, value, body) => ({ type: 'Let', name, value, body });
export const Tuple = (items) => ({ type: 'Tuple', items });
export const Swizzle = (target, field) => ({ type: 'Swizzle', target, field });
export const Decl = (kind, name, params, body) => ({ type: 'Decl', kind, name, params, body });

const PREC = {
  low: 0,
  pipe: 1,
  or: 2,
  and: 3,
  cmp: 4,
  add: 5,
  mul: 6,
  unary: 7,
  apply: 8,
  atom: 9,
};

const OP_PREC = {
  '|>': PREC.pipe,
  '||': PREC.or,
  '&&': PREC.and,
  '==': PREC.cmp,
  '/=': PREC.cmp,
  '!=': PREC.cmp,
  '<': PREC.cmp,
  '>': PREC.cmp,
  '<=': PREC.cmp,
  '>=': PREC.cmp,
  '+': PREC.add,
  '-': PREC.add,
  '*': PREC.mul,
  '/': PREC.mul,
};

function precOf(node) {
  switch (node.type) {
    case 'Num':
    case 'Color':
    case 'Bool':
    case 'Var':
    case 'Tuple':
    case 'Swizzle':
      return PREC.atom;
    case 'App':
      return PREC.apply;
    case 'UnaryOp':
      return PREC.unary;
    case 'BinOp':
      return OP_PREC[node.op] ?? PREC.low;
    default:
      return PREC.low;
  }
}

function show(node, ctx = 0) {
  const text = render(node);
  return precOf(node) < ctx ? `(${text})` : text;
}

function render(node) {
  switch (node.type) {
    case 'Num':
      return String(node.value);
    case 'Color':
      return node.value;
    case 'Bool':
      return String(node.value);
    case 'Var':
      return node.name;
    case 'App':
      return `${show(node.fn, PREC.apply)} ${show(node.arg, PREC.atom)}`;
    case 'UnaryOp':
      return `${node.op}${show(node.operand, PREC.atom)}`;
    case 'BinOp':
      return `${show(node.left, OP_PREC[node.op])} ${node.op} ${show(node.right, OP_PREC[node.op] + 1)}`;
    case 'Lambda':
      return `\\${node.params.join(' ')} -> ${render(node.body)}`;
    case 'If':
      return `if ${render(node.cond)} then ${render(node.then)} else ${render(node.alt)}`;
    case 'Let':
      return `let ${node.name} = ${render(node.value)} in ${render(node.body)}`;
    case 'Tuple':
      return `(${node.items.map((item) => show(item, 0)).join(', ')})`;
    case 'Swizzle':
      return `${show(node.target, PREC.atom)}.${node.field}`;
    case 'Decl':
      return renderDecl(node);
    default:
      throw new Error(`cannot print node of type '${node.type}'`);
  }
}

function renderDecl(decl) {
  if (decl.kind === 'pipeline') {
    return `pipeline ${decl.name}(${decl.params.join(', ')}) = ${render(decl.body)}`;
  }
  if (decl.kind === 'let') {
    return `let ${decl.name} = ${render(decl.body)}`;
  }
  return `${[decl.name, ...decl.params].join(' ')} = ${render(decl.body)}`;
}

export function print(node) {
  if (Array.isArray(node)) return node.map((item) => show(item, 0)).join('\n');
  return show(node, 0);
}
