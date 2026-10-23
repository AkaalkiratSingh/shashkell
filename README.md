# shaskell

A small Haskell-flavoured functional language for image effects, running entirely
in the browser — a hand-written lexer, parser, and evaluator, and no build step.

Image effects are naturally functional: a shader is a pure function from a pixel
(or a neighbourhood of pixels) to a colour. shaskell makes that a language, and
puts a reactive notebook around it.

## Running it

```bash
npm run serve     # python3 -m http.server 8000
# then open http://localhost:8000
```

ES modules have to be served over http — opening `index.html` from the filesystem
won't work.

```bash
npm test          # the language suite, then the UI suite
```

## The notebook

- Cells share one environment. The last expression in a cell is that cell's
  output: an image shows a thumbnail, anything else shows as text.
- Cells are reactive. Editing one re-runs it and its dependents only — a cell's
  signature is a hash of its source plus its dependencies' signatures, and
  everything is pure, so unchanged cells are memoised.
- A broken cell shows the error (message, line and column, the offending line
  highlighted) and its dependents show `blocked:` — the rest of the notebook
  keeps working.
- The right-hand pane shows the notebook's final image at full resolution.
  `full res` on a cell renders that cell instead.
- Toolbar: an **input** picker (the default gradient, any image you load, or
  "Load image…" to add one), an example gallery, **Add cell**, **Export** and
  **Import** (the notebook as JSON), and **Reset**.
- Drop an image file anywhere on the page to load it as `input` too.
- The notebook autosaves to `localStorage`.

## The language

### Comments and layout

```
-- line comment
/* block comment */
```

A line that starts in column 0 begins a new declaration; `;` also separates
declarations. Continuation lines must be indented, or sit inside brackets.

### Declarations

```
x = 3
bright k = mapPx (\(_, c) -> c * k)
pipeline sketch(img) = img |> grayscale |> edges 0.005
```

`let x = ... in ...` is also available inside any expression.

### Functions

```
\x -> x + 1
\(uv, c) -> c * uv.x      -- tuple patterns destructure their argument
\a b -> a + b
```

Everything is curried, and built-ins declare an arity, so they curry too:

```
add a b = a + b
add2 = add 2
add2 5                    -- 7
```

Note the pipe puts the left side in the *first* parameter position (`x |> f` is
`f x`), so a stage that is meant to be piped into should take the image last:
`blur r img`, not `blur img r`.

### Booleans and conditionals

`true` and `false` are literals, comparisons produce booleans, and
`if condition then a else b` is an expression:

```
cut k x = if x > k then x else x * k
```

### Pipelines

`img |> grayscale |> blur 1 |> invert` reads top to bottom. Pipelines are
ordinary values — pass them to functions, return them, put them in tuples:

```
twice f img = img |> f |> f
twice (blur 1) input
```

### Operators, loosest to tightest

```
|>   ||   &&   == /= != < > <= >=   + -   * /   unary -   application   .swizzle
```

Application is just juxtaposition: `f a b` is `(f a) b`.

Negative arguments need parentheses — `f (-1)`, not `f -1`.

### Tuples, vectors, colours

```
(1, 2, 3)          -- tuple
#ff8000            -- colour literal, about (1, 0.5, 0)
uv.x  uv.y  uv.z   -- swizzle, also .r .g .b .a
c.yx               -- reorder or duplicate components
```

Arithmetic broadcasts elementwise: `(1, 2, 3) * 2` is `(2, 4, 6)`, and
`luma c` over a colour gives a number.

### Strings

`"hi"`, with `\n`, `\t`, `\\` and `\"`. Used for `debug` labels.

## Built-ins

```
sqrt abs floor ceil round min max sum mean median clamp len dot
luma mix
grayscale invert mapPx stencil stencilWrap stencilMirror sample size debug
center at neighbors pos
```

- `luma c` — Rec.709 luminance of a colour.
- `mix a b t` — interpolate between two numbers or two colours.
- `min max sum mean median` — reducers over a collection (a tuple), elementwise
  when the collection holds colours.
- `mapPx f img` — `f` receives `(uv, c)`. `uv` is `(u, v, aspect)`: `u` and `v`
  run 0..1, and `aspect` is width/height so radial effects stay round on any
  image. `c` is the pixel colour. This is the only place the language loops over
  pixels.
- `stencil r f img` — `f` receives a window over the neighbourhood; `r` is a
  radius in **pixels**, measured against the full-resolution render. Thumbnails
  are rendered smaller, so `r` is scaled down proportionally there (a radius of
  2 at 256 px becomes 1 at 128 px). `stencilWrap` and `stencilMirror` change the
  edge handling (default clamps).
- Window API: `center w`, `at w (dx, dy)`, `neighbors w` (every pixel in the
  box), `pos w` → the `(x, y)` being computed.
- `sample img uv` — the colour at a normalised coordinate.
- `noise uv` — deterministic hash noise in 0..1, so grain is stable rather than
  flickering between renders.
- `debug "label" img` — passes the image through, tagged with the label, which
  the cell then shows.

`input` is the image currently being filtered (a generated gradient until you
load or drop one).

## Library

Preloaded into every notebook, and written in the language itself
(`src/prelude.js`):

```
blur dilate erode medianFilter edges threshold
vignette duotone mod pixelate glitch zoom
```

so the demo effects stay short and readable:

```
input |> grayscale |> blur 1 |> edges 1 |> invert
```

## Examples

Five notebooks in `src/examples.js`, loadable from the toolbar. Each defines
seven to ten functions and composes several stencils, and each works on whatever
`input` is — the generated gradient until you load a photo, which is what most
of them look best on.

| Example | What it shows |
|---|---|
| **Channel split** | hand-written stencils (`split`, `tear`, `smear`) then library stages |
| **Pencil sketch** | grayscale, median, blur, edges, dilate, invert, vignette as named stages |
| **Denoise and sharpen** | median + blur, an opening, then an unsharp mask built with `let` and `sample` |
| **Screenprint** | posterise, pixelate, blur, edges, and blending two images via `sample` |
| **Film grain** | noise under and over a bloom built from a blur and a dilate |

A three-minute demo, in order:

1. **Channel split** — open with a hand-written stencil, then show library stages
   chained with `|>`.
2. **Pencil sketch** — point out the test pattern, change the radius in the last
   cell, and watch only the dependent cells re-run.
3. Break something (delete a name, misspell a stage) to show the per-cell error
   and how the rest of the notebook carries on.
4. **Denoise and sharpen** then **Screenprint** — stencils cleaning and styling.
5. Drop your own photo onto the page and re-run.

## Project layout

```
index.html  style.css
src/
  lexer.js     source -> tokens (line and column on every token)
  parser.js    tokens -> AST (Pratt parser, layout by column)
  ast.js       AST nodes and a precedence-aware pretty-printer
  values.js    environments and runtime values
  eval.js      AST + environment -> value
  builtins.js  numeric, colour, image, stencil and window built-ins
  image.js     canvas <-> Float32Array helpers
  prelude.js   the library, written in shaskell
  examples.js  gallery notebooks
  notebook.js  cells, dependency graph, incremental re-evaluation
  main.js      wires the notebook UI to the interpreter
tests/
  run.js       lexer -> parser -> evaluator -> built-ins -> notebook
  ui.js        loads main.js against a stub DOM
```

`tests/ui.js` exists because a module-level error in `main.js` would abort
evaluation before any event listener was registered — the page would render and
nothing would respond. It asserts the module loads and that every control is
wired.

## Not implemented

- No static types (runtime checks carry a line and column instead), no laziness,
  no type classes.
- No WebGL/GLSL or WebAssembly backend — the plan's stretch goals. Effects run on
  the CPU, which is why previews use a 128px input and full-resolution renders
  are an explicit action.
- `sobel` and `hueShift` are not in the library; `edges` covers edge detection.
- Uploaded images are not persisted; only the notebook is.
