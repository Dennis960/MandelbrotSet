let cListR: f64[] = [];
let cListI: f64[] = [];
let zListR: f64[] = [];
let zListI: f64[] = [];
let nList: u64[] = [];
let currentIteration: u32 = 0;
let colorScheme: u8 = 0;

// default values
let escapeRadiusSquared: u8 = 4; // escapeRadius * escapeRadius
const escapeRadiusSplat: v128 = v128.splat<f64>(escapeRadiusSquared);

export function setColorScheme(newColorScheme: u8): void {
  colorScheme = newColorScheme;
}

export function init(canvasWidth: f64, canvasHeight: f64, x: f64, y: f64, scale: f64): void {
  const rRangeStart: f64 = (0 - x) / scale;
  const rRangeEnd: f64 = (canvasWidth - x) / scale;

  const iRangeStart: f64 = (0 - y) / scale;
  const iRangeEnd: f64 = (canvasHeight - y) / scale;

  const rStep: f64 = (rRangeEnd - rRangeStart) / canvasWidth;
  const iStep: f64 = (iRangeEnd - iRangeStart) / canvasHeight;

  cListR = [];
  cListI = [];
  zListR = [];
  zListI = [];
  nList = [];

  for (let y: f64 = 0; y < canvasHeight; y++) {
    for (let x: f64 = 0; x < canvasWidth; x++) {
      cListR.push(rRangeStart + x * rStep);
      cListI.push(iRangeStart + y * iStep);
      zListR.push(0);
      zListI.push(0);
      nList.push(0);
    }
  }

  currentIteration = 0;
}

// valuesF32 is a v128 with 4 f32 values between 0 and 1
function v128GetGrayScale(valuesF32: v128): v128 {
  const colorU8: v128 = v128.trunc_sat<u32>(v128.mul<f32>(valuesF32, v128.splat<f32>(255))); // values between 0 and 255
  const splat255: v128 = v128.splat<u8>(255);
  // red, green, blue, alpha
  return v128.shuffle<u8>(colorU8, splat255,
    0, 0, 0, 16,
    4, 4, 4, 16,
    8, 8, 8, 16,
    12, 12, 12, 16);
}

function v128GetGrayScaleSquared(valuesF32: v128): v128 {
  const f32Sqrt: v128 = v128.sqrt<f32>(valuesF32); // values between 0 and 1 but squared
  const u32: v128 = v128.trunc_sat<u32>(v128.mul<f32>(f32Sqrt, v128.splat<f32>(255))); // values between 0 and 255
  const splat255: v128 = v128.splat<u8>(255);
  // red, green, blue, alpha
  return v128.shuffle<u8>(u32, splat255,
    0, 0, 0, 16,
    4, 4, 4, 16,
    8, 8, 8, 16,
    12, 12, 12, 16);
}

function v128modf32(a: v128, b: v128): v128 {
  return v128.sub<f32>(a, v128.mul<f32>(b, v128.floor<f32>(v128.div<f32>(a, b))));
}

function v128GetRgbScale(valuesF32: v128): v128 {
  const h = v128.mul<f32>(valuesF32, v128.splat<f32>(360)); // values between 0 and 360
  const s = v128.splat<f32>(1); // 100%
  const v = v128.splat<f32>(1); // 100%

  const c = v128.mul<f32>(v, s);
  const x = v128.mul<f32>(c, v128.sub<f32>(v128.splat<f32>(1), v128.abs<f32>(v128.sub<f32>(v128modf32(v128.div<f32>(h, v128.splat<f32>(60)), v128.splat<f32>(2)), v128.splat<f32>(1)))));
  const m = v128.sub<f32>(v, c);

  const mask0_60 = v128.and(v128.lt<f32>(h, v128.splat<f32>(60)), v128.ge<f32>(h, v128.splat<f32>(0)));
  const mask60_120 = v128.and(v128.lt<f32>(h, v128.splat<f32>(120)), v128.ge<f32>(h, v128.splat<f32>(60)));
  const mask120_180 = v128.and(v128.lt<f32>(h, v128.splat<f32>(180)), v128.ge<f32>(h, v128.splat<f32>(120)));
  const mask180_240 = v128.and(v128.lt<f32>(h, v128.splat<f32>(240)), v128.ge<f32>(h, v128.splat<f32>(180)));
  const mask240_300 = v128.and(v128.lt<f32>(h, v128.splat<f32>(300)), v128.ge<f32>(h, v128.splat<f32>(240)));
  const mask300_360 = v128.and(v128.lt<f32>(h, v128.splat<f32>(360)), v128.ge<f32>(h, v128.splat<f32>(300)));

  let r = v128.or(v128.and(mask0_60, v128.add<f32>(c, m)), v128.and(mask300_360, v128.add<f32>(c, m)));
  r = v128.or(v128.and(mask240_300, v128.add<f32>(x, m)), r);
  r = v128.or(v128.and(mask180_240, v128.add<f32>(x, m)), r);
  let g = v128.or(v128.and(mask60_120, v128.add<f32>(c, m)), v128.and(mask0_60, v128.add<f32>(x, m)));
  g = v128.or(v128.and(mask300_360, v128.add<f32>(x, m)), g);
  g = v128.or(v128.and(mask240_300, v128.add<f32>(c, m)), g);
  let b = v128.or(v128.and(mask120_180, v128.add<f32>(x, m)), v128.and(mask60_120, v128.add<f32>(c, m)));
  b = v128.or(v128.and(mask0_60, v128.add<f32>(c, m)), b);
  b = v128.or(v128.and(mask300_360, v128.add<f32>(c, m)), b);

  r = v128.mul<f32>(r, v128.splat<f32>(255));
  g = v128.mul<f32>(g, v128.splat<f32>(255));
  b = v128.mul<f32>(b, v128.splat<f32>(255));

  const u32r: v128 = v128.trunc_sat<u32>(r);
  let u32g: v128 = v128.trunc_sat<u32>(g);
  u32g = v128.shl<u32>(u32g, 8);
  let u32b: v128 = v128.trunc_sat<u32>(b);
  u32b = v128.shl<u32>(u32b, 16);
  const u32a: v128 = v128.shl<u32>(v128.splat<u32>(255), 24);

  return v128.or(v128.or(u32r, u32g), v128.or(u32b, u32a));
}

function v128GetRgbScaleSqared(valuesF32: v128): v128 {
  const f32Sqrt: v128 = v128.sqrt<f32>(valuesF32); // values between 0 and 1 but squared
  return v128GetRgbScale(f32Sqrt);
}

const getColorFunction: ((valuesF32: v128) => v128)[] = [
  v128GetGrayScale,
  v128GetGrayScaleSquared,
  v128GetRgbScale,
  v128GetRgbScaleSqared
];

function getColorList(): Uint8Array {
  let colorList = new Uint8Array(nList.length * 4);
  for (let pixelIndex = 0; pixelIndex < nList.length - 3; pixelIndex += 4) {
    // load 4 u64 of nList and convert them to 4 u32
    const nValuesU64_1: v128 = v128.load(nList.dataStart + pixelIndex * 8);
    const nValuesU64_2: v128 = v128.load(nList.dataStart + (pixelIndex + 2) * 8);
    const nValuesU32: v128 = v128.shuffle<u32>(nValuesU64_1, nValuesU64_2, 0, 2, 4, 6);

    const valuesF32: v128 = v128.div<f32>(v128.convert<u32>(nValuesU32), v128.splat<f32>(<f32>currentIteration)); // values between 0 and 1

    const colorValuesRgba = getColorFunction[colorScheme](valuesF32); // convert to rgba
    v128.store(colorList.dataStart + pixelIndex * 4, colorValuesRgba);
  }
  return colorList;
}

export function iterateAll(numberOfIterations: u32): ArrayBuffer {
  for (let pixelIndex: i32 = 0; pixelIndex < zListR.length - 1; pixelIndex += 2) {
    let zR: v128 = v128.load(zListR.dataStart + pixelIndex * 8); // load 2 f64 of zListR
    let zI: v128 = v128.load(zListI.dataStart + pixelIndex * 8); // load 2 f64 of zListI
    let sR: v128 = v128.mul<f64>(zR, zR); // square zR using SIMD
    let sI: v128 = v128.mul<f64>(zI, zI); // square zI using SIMD

    let mask: v128 = v128.le<f64>(v128.add<f64>(sR, sI), escapeRadiusSplat); // compare sR + sI with escapeRadiusSquared using SIMD

    if (!v128.any_true(mask)) { // check if any of the 2 comparisons are true
      continue;
    }

    const cListIValue: v128 = v128.load(cListI.dataStart + pixelIndex * 8); // load 2 f64 of cListI
    const cListRValue: v128 = v128.load(cListR.dataStart + pixelIndex * 8); // load 2 f64 of cListR

    for (let i: u32 = 0; i < numberOfIterations; i++) {
      zI = v128.add<f64>(v128.mul<f64>(v128.splat<f64>(2), v128.mul<f64>(zR, zI)), cListIValue); // calculate zI using SIMD
      zR = v128.add<f64>(v128.sub<f64>(sR, sI), cListRValue); // calculate zR using SIMD
      sR = v128.mul<f64>(zR, zR); // square zR using SIMD
      sI = v128.mul<f64>(zI, zI); // square zI using SIMD

      if (!v128.any_true(v128.le<f64>(v128.add<f64>(sR, sI), escapeRadiusSplat))) { // check if any of the 2 comparisons are true
        break;
      }

      mask = v128.and(mask, v128.le<f64>(v128.add<f64>(sR, sI), escapeRadiusSplat)); // compare sR + sI with escapeRadiusSquared using SIMD
      const nValue: v128 = v128.load(nList.dataStart + pixelIndex * 8); // load 2 u64 of nList
      const nValueIncremented: v128 = v128.add<u64>(nValue, v128.and(mask, v128.splat<u64>(1))); // increment nValue by numberOfIterations if mask is true
      v128.store(nList.dataStart + pixelIndex * 8, nValueIncremented); // store 2 u64 of nList
    }

    v128.store(zListR.dataStart + pixelIndex * 8, zR); // store 2 f64 of zR
    v128.store(zListI.dataStart + pixelIndex * 8, zI); // store 2 f64 of zI
  }

  currentIteration += numberOfIterations;

  return getColorList().buffer;
}
