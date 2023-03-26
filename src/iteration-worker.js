// @ts-check

import { init, iterateAll, setColorScheme } from "../build/release.js";

let currentIteration = 0;
let colorListBuffer;

async function postColorList() {
  postMessage({
    colorListBuffer: colorListBuffer,
    currentIteration: currentIteration,
  });
}

let currentWorkerId = 0;

async function start(canvasSize, mandelbrotCoords, iterationsPerTick) {
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
    colorListBuffer = iterateAll(iterationsPerTick);
    currentIteration += iterationsPerTick;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

onmessage = (e) => {
  const {
    canvasSize,
    mandelbrotCoords,
    iterationsPerTick,
    command,
    colorScheme,
  } = e.data;
  if (colorScheme !== undefined) {
    setColorScheme(colorScheme);
  }
  if (command === "request") {
    postColorList();
  } else if (command === "start") {
    postMessage({ command: "started" });
    start(canvasSize, mandelbrotCoords, iterationsPerTick);
  } else if (command === "stop") {
    currentWorkerId++;
  }
};
