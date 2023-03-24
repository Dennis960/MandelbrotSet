
let cListR: f32[] = [];
let cListI: f32[] = [];
let zListR: f32[] = [];
let zListI: f32[] = [];
let nList: u32[] = [];
let currentIteration: u32 = 0;

// default values
let escapeRadiusSquared: u8 = 100; // escapeRadius * escapeRadius

export function init(canvasWidth: f32, canvasHeight: f32, x: f32, y: f32, scale: f32): void {
  const rRangeStart: f32 = (0 - x) / scale;
  const rRangeEnd: f32 = (canvasWidth - x) / scale;

  const iRangeStart: f32 = (0 - y) / scale;
  const iRangeEnd: f32 = (canvasHeight - y) / scale;

  const rStep: f32 = (rRangeEnd - rRangeStart) / canvasWidth;
  const iStep: f32 = (iRangeEnd - iRangeStart) / canvasHeight;

  cListR = [];
  cListI = [];
  zListR = [];
  zListI = [];
  nList = [];

  for (let y: f32 = 0; y < canvasHeight; y++) {
    for (let x: f32 = 0; x < canvasWidth; x++) {
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
  for (let pixelIndex: i32 = 0; pixelIndex < zListR.length; pixelIndex += 4) {
    let zR: v128 = v128.load(zListR.dataStart + pixelIndex * 4); // load 4 f32 of zR
    let zI: v128 = v128.load(zListI.dataStart + pixelIndex * 4); // load 4 f32 of zI
    let sR: v128 = v128.mul<f32>(zR, zR); // square zR using SIMD
    let sI: v128 = v128.mul<f32>(zI, zI); // square zI using SIMD

    let escapeRadiusSquaredSplat: v128 = v128.splat<f32>(escapeRadiusSquared); // splat escapeRadiusSquared to 2 f32
    let mask: v128 = v128.le<f32>(v128.add<f32>(sR, sI), escapeRadiusSquaredSplat); // compare sR + sI with escapeRadiusSquared using SIMD

    if (!v128.any_true(mask)) { // check if any of the 2 comparisons is true
      continue;
    }

    const cListIValue: v128 = v128.load(cListI.dataStart + pixelIndex * 4); // load 2 f32 of cListI
    const cListRValue: v128 = v128.load(cListR.dataStart + pixelIndex * 4); // load 2 f32 of cListR

    for (let i: u32 = 0; i < numberOfIterations; i++) {
      zI = v128.add<f32>(v128.mul<f32>(v128.splat<f32>(2), v128.mul<f32>(zR, zI)), cListIValue); // calculate zI using SIMD
      zR = v128.add<f32>(v128.sub<f32>(sR, sI), cListRValue); // calculate zR using SIMD
      sR = v128.mul<f32>(zR, zR); // square zR using SIMD
      sI = v128.mul<f32>(zI, zI); // square zI using SIMD
    }

    v128.store(zListR.dataStart + pixelIndex * 4, zR); // store 2 f32 of zR
    v128.store(zListI.dataStart + pixelIndex * 4, zI); // store 2 f32 of zI

    let n: v128 = v128.load(nList.dataStart + pixelIndex * 4); // load 2 i32 of n
    const iSplat: v128 = v128.splat<u32>(numberOfIterations); // splat i to 2 i32
    n = v128.add<u32>(n, v128.and(mask, iSplat)); // add i to n only for the true comparisons using SIMD
    v128.store(nList.dataStart + pixelIndex * 4, n); // store 2 i32 of n
  }

  currentIteration += numberOfIterations;

  let colorList = new Uint8Array(nList.length * 4);
  const factor: f32 = 255.0 / (<f32>currentIteration);
  for (let pixelIndex = 0; pixelIndex < nList.length - 1; pixelIndex += 4) {
    const nValues: v128 = v128.load(nList.dataStart + pixelIndex * 4);
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