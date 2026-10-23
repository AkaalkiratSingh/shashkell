export const PRELUDE = [
  '-- box blur: the mean over a window of radius r pixels (previews scale r down)',
  'blur r = stencil r (\\w -> mean (neighbors w))',

  '-- max/min filters: dilate brightens, erode darkens',
  'dilate r = stencil r (\\w -> max (neighbors w))',
  'erode r = stencil r (\\w -> min (neighbors w))',

  '-- median filter (good against speckle noise)',
  'medianFilter r = stencil r (\\w -> median (neighbors w))',

  '-- edge magnitude: how much the local window varies',
  'edges r = stencil r (\\w -> max (neighbors w) - min (neighbors w))',

  '-- hard cut on luminance',
  'threshold t = mapPx (\\(uv, c) -> if luma c > t then (1, 1, 1) else (0, 0, 0))',

  '-- radial darkening; uv is (u, v, aspect), so circles stay round on any image',
  'vignette k = mapPx (\\(uv, c) -> c * (1 - k * len ((uv.xy - 0.5) * (uv.z, 1))))',

  '-- map luminance onto a ramp between two colors',
  'duotone a b = mapPx (\\(uv, c) -> mix a b (luma c))',

  '-- integer remainder, handy for blocky effects',
  'mod a b = a - floor (a / b) * b',

  '-- snap each pixel to the top-left corner of an n by n block',
  'pixelate n = stencil 0 (\\w -> let p = pos w in at w (0 - (mod p.x n), 0 - (mod p.y n)))',

  '-- tear rows sideways',
  'glitch amt = stencil 0 (\\w -> let p = pos w in at w (0 - (mod (p.y * amt) 16), 0))',

  '-- scale about the centre; takes the image explicitly, so it applies the stage itself',
  'zoom k img = img |> mapPx (\\(uv, c) -> sample img ((uv.xy - 0.5) * k + 0.5))',
];
