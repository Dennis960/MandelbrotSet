let cListR: f64[] = [];
let cListI: f64[] = [];
let zListR: f64[] = [];
let zListI: f64[] = [];
let nList: u32[] = [];

// default values
let escapeRadiusSquared: u8 = 100; // escapeRadius * escapeRadius

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
}

function iterateEquation(pixelIndex: i32, iterationsPerTick: i32): void {
  let zR = zListR[pixelIndex];
  let zI = zListI[pixelIndex];
  let sR = zR * zR;
  let sI = zI * zI;

  for (let i: i32 = 0; i < iterationsPerTick; i++) {
    if (sR + sI <= escapeRadiusSquared) {
      zI = 2 * zR * zI + cListI[pixelIndex];
      zR = sR - sI + cListR[pixelIndex];
      sR = zR * zR;
      sI = zI * zI;
      zListR[pixelIndex] = zR;
      zListI[pixelIndex] = zI;
      nList[pixelIndex] = nList[pixelIndex] + 1;
    }
  }
}

export function iterateAll(numberOfIterations: i32): u32[] {
  for (let pixelIndex: i32 = 0; pixelIndex < nList.length; pixelIndex++) {
    iterateEquation(pixelIndex, numberOfIterations);
  }
  return nList;
}