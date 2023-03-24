// @ts-check

import { init, iterateAll } from "../build/release.js";

let currentIteration = 0;
let nList = [];

async function postColorList() {
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

let currentWorkerId = 0;

async function start(canvasSize, mandelbrotCoords) {
  const workerID = ++currentWorkerId;
  currentIteration = 0;
  init(
    canvasSize[0],
    canvasSize[1],
    mandelbrotCoords[0],
    mandelbrotCoords[1],
    mandelbrotCoords[2]
  );

  while (workerID === currentWorkerId) {
    const iterationAmount = 1;
    console.time("iterateAll");
    for (let i = 0; i < iterationAmount; i++) {
      nList = iterateAll(1);
    }
    console.timeEnd("iterateAll");
    currentIteration += iterationAmount;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

onmessage = (e) => {
  const { canvasSize, mandelbrotCoords, command } = e.data;
  if (command === "request") {
    postColorList();
  } else if (command === "start") {
    start(canvasSize, mandelbrotCoords);
  } else if (command === "stop") {
    currentWorkerId++;
  }
};
