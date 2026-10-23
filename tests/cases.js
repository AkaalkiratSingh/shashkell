export const lexerCases = [
  {
    name: 'lambda body',
    source: '\\(uv, c) -> c * 0.5',
    tokens: [
      ['op', '\\'],
      ['punct', '('],
      ['ident', 'uv'],
      ['punct', ','],
      ['ident', 'c'],
      ['punct', ')'],
      ['op', '->'],
      ['ident', 'c'],
      ['op', '*'],
      ['number', 0.5],
      ['eof', null],
    ],
  },
  {
    name: 'pipe chain',
    source: 'input |> blur 0.004',
    tokens: [
      ['ident', 'input'],
      ['op', '|>'],
      ['ident', 'blur'],
      ['number', 0.004],
      ['eof', null],
    ],
  },
  {
    name: 'let in',
    source: 'let y = 2 in y * y',
    tokens: [
      ['keyword', 'let'],
      ['ident', 'y'],
      ['op', '='],
      ['number', 2],
      ['keyword', 'in'],
      ['ident', 'y'],
      ['op', '*'],
      ['ident', 'y'],
      ['eof', null],
    ],
  },
  {
    name: 'hex colors and comments',
    source: '#FF8800 -- a comment\n#0f0',
    tokens: [
      ['color', '#ff8800'],
      ['color', '#0f0'],
      ['eof', null],
    ],
  },
  {
    name: 'block comments',
    source: 'a /* ignore\n me */ b',
    tokens: [
      ['ident', 'a'],
      ['ident', 'b'],
      ['eof', null],
    ],
  },
  {
    name: 'primes and exponents',
    source: "x' = 1.5e-3",
    tokens: [
      ['ident', "x'"],
      ['op', '='],
      ['number', 0.0015],
      ['eof', null],
    ],
  },
  {
    name: 'keywords and comparisons',
    source: 'if a >= 1 && true then b else c',
    tokens: [
      ['keyword', 'if'],
      ['ident', 'a'],
      ['op', '>='],
      ['number', 1],
      ['op', '&&'],
      ['keyword', 'true'],
      ['keyword', 'then'],
      ['ident', 'b'],
      ['keyword', 'else'],
      ['ident', 'c'],
      ['eof', null],
    ],
  },
  {
    name: 'declaration with arguments',
    source: 'blur r = stencil r (\\w -> mean (neighbors w))',
    tokens: [
      ['ident', 'blur'],
      ['ident', 'r'],
      ['op', '='],
      ['ident', 'stencil'],
      ['ident', 'r'],
      ['punct', '('],
      ['op', '\\'],
      ['ident', 'w'],
      ['op', '->'],
      ['ident', 'mean'],
      ['punct', '('],
      ['ident', 'neighbors'],
      ['ident', 'w'],
      ['punct', ')'],
      ['punct', ')'],
      ['eof', null],
    ],
  },
];

export const positionCases = [
  {
    name: 'columns on one line',
    source: 'a + bb',
    positions: [
      [1, 1, 'a'],
      [1, 3, '+'],
      [1, 5, 'bb'],
      [1, 7, null],
    ],
  },
  {
    name: 'line tracking',
    source: 'let x = 1\nin x',
    positions: [
      [2, 1, 'in'],
      [2, 4, 'x'],
      [2, 5, null],
    ],
    from: 4,
  },
];

export const errorCases = [
  { name: 'unterminated block comment', source: '/* nope' },
  { name: 'short hex color', source: 'a #12' },
  { name: 'unexpected character', source: 'a $ b' },
];
