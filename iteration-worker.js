// @ts-check

import { CoordSystem } from "./coord-system.js";

let cList = [];
let zListR = [];
let zListI = [];
let nList = [];
let currentIteration = 1;

// default values
const escapeRadius = 10;
const escapeRadiusSquared = Math.pow(escapeRadius, 2);

/**
 *
 * @param {number} pixelIndex
 * @param {number} iterationsPerTick
 * @returns
 */
function iterateEquation(pixelIndex, iterationsPerTick) {
  let zR = zListR[pixelIndex];
  let zI = zListI[pixelIndex];
  let sR = zR * zR;
  let sI = zI * zI;

  for (let i = 0; i < iterationsPerTick; i++) {
    if (sR + sI <= escapeRadiusSquared) {
      zI = 2 * zR * zI + cList[pixelIndex][1];
      zR = sR - sI + cList[pixelIndex][0];
      sR = zR * zR;
      sI = zI * zI;
      zListR[pixelIndex] = zR;
      zListI[pixelIndex] = zI;
      nList[pixelIndex] = nList[pixelIndex] + 1;
    }
  }
}

/**
 *
 * @param {[number, number]} canvasSize
 * @param {number} iterationsPerTick
 * @param {[number, number, number]} mandelbrotCoords
 */
async function run(canvasSize, iterationsPerTick, mandelbrotCoords) {
  const mandelbrotCoordSystem = new CoordSystem(...mandelbrotCoords);
  const mandelbrotTopLeft = mandelbrotCoordSystem.fromViewport(0, 0);
  const mandelbrotBottomRight = mandelbrotCoordSystem.fromViewport(
    ...canvasSize
  );
  const rRange = [mandelbrotTopLeft[0], mandelbrotBottomRight[0]];
  const iRange = [mandelbrotTopLeft[1], mandelbrotBottomRight[1]];
  const rStep = (rRange[1] - rRange[0]) / canvasSize[0];
  const iStep = (iRange[1] - iRange[0]) / canvasSize[1];
  for (let y = 0; y < canvasSize[1]; y++) {
    for (let x = 0; x < canvasSize[0]; x++) {
      cList.push([rRange[0] + x * rStep, iRange[0] + y * iStep]);
      zListR.push(0);
      zListI.push(0);
      nList.push(0);
    }
  }

  while (true) {
    currentIteration += iterationsPerTick;
    for (let pixelIndex = 0; pixelIndex < cList.length; pixelIndex++) {
      iterateEquation(pixelIndex, iterationsPerTick);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function start(canvasSize, iterationsPerTick, mandelbrotCoords) {
  run(canvasSize, iterationsPerTick, mandelbrotCoords);
}

function postColorList() {
  let colorList = new Uint8Array(nList.length * 4);
  const factor = 255 / currentIteration;

  for (let pixelIndex = 0; pixelIndex < nList.length; pixelIndex++) {
    let value = nList[pixelIndex] * factor;
    colorList[pixelIndex * 4 + 0] = value;
    colorList[pixelIndex * 4 + 1] = value;
    colorList[pixelIndex * 4 + 2] = value;
    colorList[pixelIndex * 4 + 3] = 255;
  }

  postMessage({
    colorListBuffer: colorList.buffer,
    currentIteration: currentIteration,
  });
}

onmessage = (e) => {
  const { canvasSize, iterationsPerTick, mandelbrotCoords, command } = e.data;
  if (command === "request") {
    postColorList();
  } else if (command === "start") {
    start(canvasSize, iterationsPerTick, mandelbrotCoords);
  }
};
