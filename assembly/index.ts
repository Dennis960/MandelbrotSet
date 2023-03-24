let cListR: f64[] = [];
let cListI: f64[] = [];
let zListR: f64[] = [];
let zListI: f64[] = [];
let nList: u64[] = [];
let currentIteration: u32 = 0;

// default values
let escapeRadiusSquared: u8 = 4; // escapeRadius * escapeRadius
const escapeRadiusSplat: v128 = v128.splat<f64>(escapeRadiusSquared);

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

export function iterateAll(numberOfIterations: u32): ArrayBuffer {
  for (let pixelIndex: i32 = 0; pixelIndex < zListR.length - 1; pixelIndex += 2) {
    let zR: v128 = v128.load(zListR.dataStart + pixelIndex * 8); // load 2 f64 of zListR
    let zI: v128 = v128.load(zListI.dataStart + pixelIndex * 8); // load 2 f64 of zListI
    let sR: v128 = v128.mul<f64>(zR, zR); // square zR using SIMD
    let sI: v128 = v128.mul<f64>(zI, zI); // square zI using SIMD

    let mask: v128 = v128.le<f64>(v128.add<f64>(sR, sI), escapeRadiusSplat); // compare sR + sI with escapeRadiusSquared using SIMD

    if (!v128.any_true(mask)) { // check if any of the 2 comparisons is true
      continue;
    }

    const cListIValue: v128 = v128.load(cListI.dataStart + pixelIndex * 8); // load 2 f64 of cListI
    const cListRValue: v128 = v128.load(cListR.dataStart + pixelIndex * 8); // load 2 f64 of cListR

    for (let i: u32 = 0; i < numberOfIterations; i++) {
      zI = v128.add<f64>(v128.mul<f64>(v128.splat<f64>(2), v128.mul<f64>(zR, zI)), cListIValue); // calculate zI using SIMD
      zR = v128.add<f64>(v128.sub<f64>(sR, sI), cListRValue); // calculate zR using SIMD
      sR = v128.mul<f64>(zR, zR); // square zR using SIMD
      sI = v128.mul<f64>(zI, zI); // square zI using SIMD
    }

    v128.store(zListR.dataStart + pixelIndex * 8, zR); // store 2 f64 of zR
    v128.store(zListI.dataStart + pixelIndex * 8, zI); // store 2 f64 of zI

    const nValue: v128 = v128.load(nList.dataStart + pixelIndex * 8); // load 2 u64 of nList
    const nValueIncrement: v128 = v128.splat<u64>(numberOfIterations); // create a vector with 2 times the same value
    const nValueIncremented: v128 = v128.add<u64>(nValue, v128.and(mask, nValueIncrement)); // increment nValue by numberOfIterations if mask is true
    v128.store(nList.dataStart + pixelIndex * 8, nValueIncremented); // store 2 u64 of nList
  }

  currentIteration += numberOfIterations;

  let colorList = new Uint8Array(nList.length * 4);
  const factor: f32 = 255.0 / (<f32>currentIteration);
  for (let pixelIndex = 0; pixelIndex < nList.length - 3; pixelIndex += 4) {
    // load 4 u64 of nList and convert them to 4 u32
    const nValues1: v128 = v128.load(nList.dataStart + pixelIndex * 8);
    const nValues2: v128 = v128.load(nList.dataStart + (pixelIndex + 2) * 8);
    const nValues: v128 = v128.shuffle<u32>(nValues1, nValues2, 0, 2, 4, 6);
    const values: v128 = v128.mul<f32>(v128.convert<u32>(nValues), v128.splat<f32>(factor));
    const valuesAsU32: v128 = v128.trunc_sat<u32>(values);
    const splat255: v128 = v128.splat<u32>(255);
    // repeat each byte 3 times and, as fourth bytes, set 255
    const valueVec: v128 = v128.shuffle<u8>(valuesAsU32, splat255,
      0, 0, 0, 16,
      4, 4, 4, 16,
      8, 8, 8, 16,
      12, 12, 12, 16)
    v128.store(colorList.dataStart + pixelIndex * 4, valueVec);
  }

  return colorList.buffer;
}