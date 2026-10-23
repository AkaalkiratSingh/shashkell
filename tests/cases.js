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

export const parserCases = [
  { name: 'application', source: 'f a b', printed: 'f a b' },
  { name: 'pipe chain', source: 'a |> f 1 |> g', printed: 'a |> f 1 |> g' },
  { name: 'lambda', source: '\\x -> x + 1', printed: '\\x -> x + 1' },
  { name: 'multi-arg lambda', source: '\\a b -> a', printed: '\\a b -> a' },
  { name: 'let in', source: 'let y = 2 in y * y', printed: 'let y = 2 in y * y' },
  { name: 'arithmetic precedence', source: 'a + b * c', printed: 'a + b * c' },
  { name: 'explicit parens kept', source: '(a + b) * c', printed: '(a + b) * c' },
  { name: 'right-assoc subtraction', source: 'a - (b - c)', printed: 'a - (b - c)' },
  { name: 'unary minus argument', source: 'f (-1)', printed: 'f (-1)' },
  { name: 'tuple', source: '(x, y, 0.5)', printed: '(x, y, 0.5)' },
  { name: 'swizzle', source: 'uv.x + c.yz', printed: 'uv.x + c.yz' },
  { name: 'if then else', source: 'if a > b then a else b', printed: 'if a > b then a else b' },
  { name: 'lambda in application', source: 'stencil r (\\w -> mean (neighbors w))', printed: 'stencil r (\\w -> mean (neighbors w))' },
  { name: 'function declaration', source: 'bright k = mapPx (\\c -> c * k)', printed: 'bright k = mapPx (\\c -> c * k)' },
  { name: 'let declaration', source: 'let r = 0.004', printed: 'let r = 0.004' },
  { name: 'value declaration', source: 'r = 0.004', printed: 'r = 0.004' },
  { name: 'pipeline declaration', source: 'pipeline sketch(img, detail) = img |> grayscale |> edges detail', printed: 'pipeline sketch(img, detail) = img |> grayscale |> edges detail' },
  {
    name: 'layout separates statements',
    source: 'blur r = stencil r\ninput |> blur 0.004',
    printed: 'blur r = stencil r\ninput |> blur 0.004',
  },
  { name: 'semicolon separator', source: 'a = 1; b = 2; a + b', printed: 'a = 1\nb = 2\na + b' },
];

export const parserErrorCases = [
  { name: 'incomplete lambda', source: '\\x ->' },
  { name: 'pipeline without parens', source: 'pipeline sketch = 1' },
  { name: 'unclosed paren', source: '(a + b' },
  { name: 'invalid declaration target', source: '1 + 2 = 3' },
  { name: 'missing else', source: 'if a then b' },
];
