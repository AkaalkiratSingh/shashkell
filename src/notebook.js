import { LangError } from './errors.js';
import { parse } from './parser.js';
import { createGlobalEnv, evalProgram, makeRuntime } from './eval.js';
import { envDelete } from './values.js';

export function createNotebook(sources = []) {
  return {
    nextId: sources.length,
    cells: sources.map((source, index) => ({ id: `c${index}`, source })),
    env: null,
    input: undefined,
    results: new Map(),
    signatures: new Map(),
    defined: new Map(),
    runs: new Map(),
  };
}

export function setSource(notebook, index, source) {
  notebook.cells[index].source = source;
}

export function insertCell(notebook, index, source = '') {
  const id = `c${notebook.nextId++}`;
  notebook.cells.splice(index, 0, { id, source });
  return id;
}

export function removeCellAt(notebook, index) {
  const [cell] = notebook.cells.splice(index, 1);
  if (!cell) return;
  notebook.results.delete(cell.id);
  notebook.signatures.delete(cell.id);
  notebook.defined.delete(cell.id);
  notebook.runs.delete(cell.id);
}

export function moveCell(notebook, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= notebook.cells.length) return;
  const [cell] = notebook.cells.splice(index, 1);
  notebook.cells.splice(target, 0, cell);
}

export function notebookJSON(notebook) {
  return JSON.stringify({ cells: notebook.cells.map((cell) => cell.source) }, null, 2);
}

export function notebookFromJSON(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.cells)) throw new Error('notebook JSON must have a "cells" array');
  return createNotebook(data.cells);
}

export function collectFree(node, bound, out) {
  switch (node.type) {
    case 'Var':
      if (!bound.has(node.name)) out.add(node.name);
      return;
    case 'Num':
    case 'Color':
    case 'Bool':
      return;
    case 'Lambda': {
      const inner = new Set(bound);
      addPatternNames(node.params, inner);
      collectFree(node.body, inner, out);
      return;
    }
    case 'Let': {
      collectFree(node.value, bound, out);
      const inner = new Set(bound);
      inner.add(node.name);
      collectFree(node.body, inner, out);
      return;
    }
    case 'Decl': {
      const inner = new Set(bound);
      inner.add(node.name);
      for (const param of node.params) inner.add(param);
      collectFree(node.body, inner, out);
      return;
    }
    case 'App':
      collectFree(node.fn, bound, out);
      collectFree(node.arg, bound, out);
      return;
    case 'UnaryOp':
      collectFree(node.operand, bound, out);
      return;
    case 'BinOp':
      collectFree(node.left, bound, out);
      collectFree(node.right, bound, out);
      return;
    case 'If':
      collectFree(node.cond, bound, out);
      collectFree(node.then, bound, out);
      collectFree(node.alt, bound, out);
      return;
    case 'Tuple':
      for (const item of node.items) collectFree(item, bound, out);
      return;
    case 'Swizzle':
      collectFree(node.target, bound, out);
      return;
    default:
      return;
  }
}

function addPatternNames(patterns, set) {
  for (const pattern of patterns) {
    if (typeof pattern === 'string') set.add(pattern);
    else addPatternNames(pattern, set);
  }
}

export function analyze(source) {
  const program = parse(source);
  const defined = [];
  for (const statement of program) {
    if (statement.type === 'Decl') defined.push(statement.name);
  }
  const bound = new Set(defined);
  const free = new Set();
  for (const statement of program) collectFree(statement, bound, free);
  for (const name of defined) free.delete(name);
  return { program, defined, free: [...free] };
}

function hash(text) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(16);
}

function topoSort(ids, deps) {
  const order = [];
  const state = new Map();
  const cycleNodes = new Set();

  const visit = (id, path) => {
    const seen = state.get(id) ?? 0;
    if (seen === 2) return;
    if (seen === 1) {
      for (const node of path.slice(path.indexOf(id))) cycleNodes.add(node);
      return;
    }
    state.set(id, 1);
    path.push(id);
    for (const dep of deps.get(id) ?? []) visit(dep, path);
    path.pop();
    state.set(id, 2);
    order.push(id);
  };

  for (const id of ids) visit(id, []);
  return { order, cycleNodes };
}

export function update(notebook, ctx = {}) {
  if (!notebook.env || notebook.input !== ctx.input) {
    notebook.env = createGlobalEnv(ctx);
    notebook.input = ctx.input;
    notebook.signatures.clear();
  }
  const { env } = notebook;
  const runtime = makeRuntime(ctx);
  const { cells } = notebook;
  const byId = new Map(cells.map((cell) => [cell.id, cell]));

  const analyses = new Map();
  for (const cell of cells) {
    try {
      const { program, defined, free } = analyze(cell.source);
      analyses.set(cell.id, { program, defined, free, error: null });
    } catch (error) {
      analyses.set(cell.id, { program: null, defined: [], free: [], error });
    }
  }

  const nameToCell = new Map();
  for (const cell of cells) {
    for (const name of analyses.get(cell.id).defined) nameToCell.set(name, cell.id);
  }

  const deps = new Map();
  for (const cell of cells) {
    const set = new Set();
    for (const name of analyses.get(cell.id).free) {
      const owner = nameToCell.get(name);
      if (owner !== undefined && owner !== cell.id) set.add(owner);
    }
    deps.set(cell.id, set);
  }

  const { order, cycleNodes } = topoSort(
    cells.map((cell) => cell.id),
    deps,
  );

  const signatures = new Map();
  const signatureOf = (id) => {
    if (signatures.has(id)) return signatures.get(id);
    const analysis = analyses.get(id);
    let signature;
    if (analysis.error) {
      signature = hash(`${byId.get(id).source}|error`);
    } else if (cycleNodes.has(id)) {
      signature = hash(`${byId.get(id).source}|cycle`);
    } else {
      const depSignatures = [...deps.get(id)].map(signatureOf).sort();
      signature = hash(`${byId.get(id).source}|${depSignatures.join(',')}`);
    }
    signatures.set(id, signature);
    return signature;
  };
  for (const id of order) signatureOf(id);

  for (const id of order) {
    const signature = signatures.get(id);
    if (notebook.signatures.get(id) === signature && notebook.results.has(id)) continue;
    notebook.signatures.set(id, signature);

    for (const name of notebook.defined.get(id) ?? []) envDelete(env, name);

    const analysis = analyses.get(id);
    let result;
    let ran = false;

    if (analysis.error) {
      result = { error: analysis.error };
    } else if (cycleNodes.has(id)) {
      result = { error: new LangError('dependency cycle', 1, 1) };
    } else {
      const broken = [...deps.get(id)].filter((depId) => {
        const depResult = notebook.results.get(depId);
        return depResult && (depResult.error || depResult.blocked);
      });
      if (broken.length > 0) {
        result = { blocked: true, reason: `depends on ${broken.map((depId) => byId.get(depId).id).join(', ')}` };
      } else {
        try {
          result = { value: evalProgram(analysis.program, env, runtime) };
          ran = true;
        } catch (error) {
          result = { error };
        }
      }
    }

    notebook.results.set(id, result);
    notebook.defined.set(id, analysis.defined);
    notebook.runs.set(id, (notebook.runs.get(id) ?? 0) + (ran ? 1 : 0));
  }

  return cells.map((cell) => notebook.results.get(cell.id));
}
