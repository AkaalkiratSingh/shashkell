// Each example is a small notebook: a few cells that share one environment.
// Every one works on the current `input` — the generated gradient by default,
// or an image loaded from the toolbar.

export const EXAMPLES = [
  {
    name: 'Channel split',
    cells: [
      `-- the library is preloaded: blur, dilate, erode, medianFilter, edges,
-- threshold, vignette, duotone, pixelate, glitch, zoom

-- each channel is sampled from a different offset, then the rows tear sideways
split d = stencil 0 (\\w -> ((at w (d, 0)).r, (at w (0, d)).g, (center w).b))
tear amt = stencil 0 (\\w -> let p = pos w in at w (0 - (mod (p.y * amt) 24), 0))
smear k = stencil k (\\w -> mean (neighbors w))`,

      `-- and the slower stages: soften, block up, push to two tones, darken the edges
soften k img = blur k img
chip n img = pixelate n img
ink a b img = img |> duotone a b
frame k img = vignette k img`,

      'input |> split 6 |> tear 3 |> smear 0.004 |> soften 0.003 |> chip 4 |> ink (#12002b) (#59f7ff) |> frame 0.5',
    ],
  },

  {
    name: 'Pencil sketch',
    cells: [
      `-- stages: flatten to luminance, wipe the speckle, smooth, take the local
-- contrast, thicken the lines, invert onto paper, settle the corners
flatten img = grayscale img
dust k img = medianFilter k img
smooth k img = blur k img
ink k img = edges k img
thicken k img = dilate k img
paper img = invert img
shade k img = vignette k img`,

      'sketch k img = img |> flatten |> dust 0.002 |> smooth 0.002 |> ink k |> thicken 0.002 |> paper |> shade 0.45',

      'input |> sketch 0.004',
    ],
  },

  {
    name: 'Denoise and sharpen',
    cells: [
      `-- throw speckle at the input, then clean it back up
speckle k img = img |> mapPx (\\(uv, c) -> c + (noise uv - 0.5) * k)`,

      `-- stencils: median then blur lift the speckle out, an opening
-- (erode then dilate) removes whatever is left
clean k img = img |> medianFilter k |> blur k
opening k img = img |> erode k |> dilate k
tone img = img |> duotone (#06283d) (#e0fbfc)
frame img = img |> vignette 0.4`,

      `-- unsharp mask: compare against a blurred copy and add back the difference
sharpen k img = let low = blur 0.003 img in img |> mapPx (\\(uv, c) -> c + (c - sample low uv) * k)`,

      'restore k img = img |> clean k |> opening k |> tone |> sharpen k |> frame',

      'input |> speckle 0.5 |> restore 0.004',
    ],
  },

  {
    name: 'Screenprint',
    cells: [
      `-- band the colours, block the image up, soften the blocks,
-- and lay the original's edges back over the top
bands n img = img |> mapPx (\\(uv, c) -> round (c * n) / n)
coarse n img = img |> pixelate n
melt k img = img |> blur k
lines k img = img |> edges k
grow k img = dilate k img
ink a b img = img |> duotone a b
paper img = img |> vignette 0.5`,

      `-- blending two images: the pixel function closes over 'top' and samples it
blend k top img = img |> mapPx (\\(uv, c) -> mix c (sample top uv) k)`,

      'under = input |> bands 4 |> coarse 16 |> melt 0.002 |> ink (#101820) (#f2aa4c)\nover = input |> grayscale |> lines 0.003 |> grow 0.002 |> invert',

      'under |> blend 0.35 over |> paper',
    ],
  },

  {
    name: 'Film grain',
    cells: [
      `-- grain twice: once under the bloom, once over the top
grainAt uv k = (noise uv - 0.5) * k
grain k img = img |> mapPx (\\(uv, c) -> c + grainAt uv k)

-- stencils: dust off the speckle, bloom a bright copy, lift its highlights
dust k img = img |> medianFilter k
bloom k img = img |> blur k
lift k img = img |> dilate k`,

      `addGlow k top img = img |> mapPx (\\(uv, c) -> c + sample top uv * k)
warm img = img |> duotone (#2b1d0e) (#ffe6b3)
frame img = img |> vignette 0.75

flat = input |> grayscale
glow = flat |> lift 0.006 |> bloom 0.012`,

      'flat |> dust 0.003 |> warm |> addGlow 0.6 glow |> grain 0.22 |> frame',
    ],
  },
];
