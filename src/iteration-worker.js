// @ts-check

import { init, iterateAll } from "../build/release.js";

let currentIteration = 0;

async function postColorList() {
  const nList = iterateAll(10);
  currentIteration += 10;

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
  const { canvasSize, mandelbrotCoords, command } = e.data;
  console.log(command);
  if (command === "request") {
    postColorList();
  } else if (command === "start") {
    init(
      canvasSize[0],
      canvasSize[1],
      mandelbrotCoords[0],
      mandelbrotCoords[1],
      mandelbrotCoords[2]
    );
  }
};
