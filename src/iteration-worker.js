// @ts-check

import { init, iterateAll } from "../build/release.js";

let currentIteration = 0;
let colorListBuffer;

async function postColorList() {
  postMessage({
    colorListBuffer: colorListBuffer,
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
    colorListBuffer = iterateAll(iterationAmount);
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
