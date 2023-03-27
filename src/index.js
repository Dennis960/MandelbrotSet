// @ts-check

import { CoordSystem } from "./coord-system.js";
import { NumberInput } from "./elements.js";
import { $ } from "./query.js";
import { addCurrentUrlToHistory } from "./url-state.js";

const maxNumberOfThreads = navigator.hardwareConcurrency || 1;

// html inputs
const radiusInput = new NumberInput("radius", 2);
const realInput = new NumberInput("real", 0);
const imaginaryInput = new NumberInput("imaginary", 0);
const maxIterationsInput = new NumberInput("max-iterations", 0);
const iterationAmountInput = new NumberInput("iteration-amount", 50);
const threadsInput = new NumberInput("threads", maxNumberOfThreads);
const debounceTimeInput = new NumberInput("debounce-time", 600);
const fpsInput = new NumberInput("fps", 60);
const resolutionInput = new NumberInput("resolution", 1);
const colorSchemeSelect = new NumberInput("color-scheme", 0);

// html elements
const iterationsLabel = $("iterations");
const infoForm = $("info-form");
const hideOverlayButton = $("hide-overlay-button");
const showAdvancedButton = $("show-advanced-button");
const resetButton = $("reset-button");
const showOverlayButton = $("show-overlay-button");
const tooltip = $("tooltip");

/**
 * @type {HTMLCanvasElement}
 */
const canvas = $("canvas");

/**
 * @type {CanvasRenderingContext2D}
 */
// @ts-ignore
const ctx = canvas.getContext("2d");

canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;
/**
 * @type {ImageData}
 */
let imgData;

const mandelbrotCoordSystem = new CoordSystem();
let lastMandelbrotCoordSystem = null;

let transformationDebounceTimeout = null;

let lastDistance;
let lastTouchPosition;
let lastMousePosition;

/**
 * @type {ArrayBuffer[]}
 */
let colorLists = [];
let colorList = new Uint8ClampedArray();

/**
 * @type {{worker: Worker, uid: number, status: number}[]}
 */
const workerList = [];

let currentWorkerId = 0;

const iterations = [];

let maxIterations = 0;

function loadMandelbrotCoordsFromForm() {
  canvas.width = window.innerWidth * resolutionInput.value;
  canvas.height = window.innerHeight * resolutionInput.value;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  mandelbrotCoordSystem.scale =
    Math.min(canvas.width, canvas.height) / 2 / radiusInput.value;
  mandelbrotCoordSystem.x =
    canvas.width / 2 - realInput.value * mandelbrotCoordSystem.scale;
  mandelbrotCoordSystem.y =
    canvas.height / 2 - imaginaryInput.value * mandelbrotCoordSystem.scale;
}

function resetMandelbrot() {
  canvas.width = window.innerWidth * resolutionInput.value;
  canvas.height = window.innerHeight * resolutionInput.value;
  mandelbrotCoordSystem.x = canvas.width / 2;
  mandelbrotCoordSystem.y = canvas.height / 2;
  mandelbrotCoordSystem.scale = Math.min(canvas.width, canvas.height) / 4;
  realInput.value = 0;
  imaginaryInput.value = 0;
  radiusInput.value = 2;
  iterationAmountInput.value = 50;
  colorSchemeSelect.value = 0;
}

function requestAllWorkers() {
  for (let i = 0; i < workerList.length; i++) {
    const iterationWorker = workerList[i].worker;
    if (workerList[i].status === 2) continue;
    iterationWorker.postMessage({
      command: "request",
      colorScheme: colorSchemeSelect.value,
    });
  }
}

function drawMandelbrot() {
  if (transformationDebounceTimeout) return;
  if (colorList.byteLength !== canvas.width * canvas.height * 4) {
    console.log("resize");
    // update color list length
    colorList = new Uint8ClampedArray(canvas.width * canvas.height * 4);
  }

  let offset = 0;
  for (const list of colorLists) {
    if (!list || list.byteLength === 0) return;
    if (offset + list.byteLength > colorList.byteLength) {
      console.error("color list too long, skipping render");
      return;
    }
    colorList.set(new Uint8ClampedArray(list), offset);
    offset += list.byteLength;
  }

  imgData = new ImageData(colorList, canvas.width, canvas.height);
  ctx.putImageData(imgData, 0, 0);
}

/**
 * @param {ArrayBuffer} colorListBuffer
 * @param {number} iterationWorkerIndex
 */
function addColorList(colorListBuffer, iterationWorkerIndex) {
  colorLists[iterationWorkerIndex] = colorListBuffer;
  drawMandelbrot();
  const avgIteration =
    iterations.reduce((a, b) => a + b, 0) / iterations.length;
  iterationsLabel.innerHTML = Math.floor(avgIteration);
  if (maxIterationsInput.value != -1) {
    iterationsLabel.innerHTML += ` / ${maxIterations}`;
  }
}

/**
 *
 * @param {number} amount
 */
function initWorkers(amount) {
  // remove unused workers
  for (let i = amount; i < workerList.length; i++) {
    workerList[i].worker.terminate();
  }
  workerList.length = Math.min(amount, workerList.length);
  // add missing workers
  for (let i = workerList.length; i < amount; i++) {
    const iterationWorker = new Worker("./src/iteration-worker.js", {
      type: "module",
    });
    workerList.push({
      worker: iterationWorker,
      uid: currentWorkerId++,
      status: 0,
    });
    iterationWorker.onmessage = (event) => {
      if (event.data.command === "started") {
        workerList[i].status = 1;
      } else {
        iterations[i] = event.data.currentIteration;
        addColorList(event.data.colorListBuffer, i);
        if (event.data.currentIteration === maxIterations) {
          workerList[i].status = 2;
        }
      }
    };

    iterationWorker.addEventListener("error", (error) => {
      console.error(error);
    });
  }
  iterations.length = 0;
}

/**
 * Starts the iteration worker with the given index (not the worker id)
 *
 * @param {number} i
 */
async function startWorker(i) {
  const iterationWorker = workerList[i].worker;
  const mandelbrotCoords = [
    mandelbrotCoordSystem.x,
    mandelbrotCoordSystem.y - (canvas.height / workerList.length) * i,
    mandelbrotCoordSystem.scale,
  ];
  maxIterations = maxIterationsInput.value;
  if (maxIterationsInput.value == -1) {
    maxIterations = 0;
  } else if (maxIterationsInput.value == 0) {
    maxIterations = 50 + Math.log10(4 / Math.abs(2 * radiusInput.value)) ** 5;
  }
  maxIterations = Math.floor(maxIterations);

  iterationWorker.postMessage({
    canvasSize: [canvas.width, Math.floor(canvas.height / workerList.length)],
    mandelbrotCoords: mandelbrotCoords,
    iterationsPerTick: iterationAmountInput.value,
    maxIterations: maxIterations,
    command: "start",
  });

  // if the worker does not respond within 500ms, restart it
  new Promise((resolve) => {
    setTimeout(resolve, 500);
  }).then(() => {
    if (!workerList[i].status && workerList[i].uid >= workerList[0].uid) {
      console.log(
        `worker ${i} with uid ${workerList[i].uid} did not respond, restarting`
      );
      startWorker(i);
    }
  });
}

function restartIterationWorkers() {
  if (workerList.length !== threadsInput.value) {
    initWorkers(threadsInput.value);
    colorLists.length = 0;
  }
  // clear list
  for (let i = 0; i < workerList.length; i++) {
    iterations[i] = 0;
    startWorker(i);
  }
  // clear color list
  colorLists.length = 0;
}

function onTransformation() {
  if (transformationDebounceTimeout) {
    clearTimeout(transformationDebounceTimeout);
  } else {
    addCurrentUrlToHistory();
    lastMandelbrotCoordSystem = mandelbrotCoordSystem.clone();
    if (debounceTimeInput.value != 0) {
      for (const iterationWorker of workerList) {
        iterationWorker.worker.postMessage({
          command: "stop",
        });
      }
    }
  }
  transformationDebounceTimeout = setTimeout(() => {
    restartIterationWorkers();
    transformationDebounceTimeout = null;
  }, debounceTimeInput.value);

  if (!imgData) {
    // no need to draw if there is no image data
    return;
  }

  const scale = mandelbrotCoordSystem.scale / lastMandelbrotCoordSystem.scale;

  const [left, top] = lastMandelbrotCoordSystem.fromViewport(0, 0);
  const [left2, top2] = mandelbrotCoordSystem.toViewport(left, top);

  const canvas2 = document.createElement("canvas");
  canvas2.width = canvas.width;
  canvas2.height = canvas.height;
  /**
   * @type {CanvasRenderingContext2D}
   */
  // @ts-ignore
  const ctx2 = canvas2.getContext("2d");
  ctx2.putImageData(imgData, 0, 0);

  ctx.resetTransform();
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(left2, top2);
  ctx.scale(scale, scale);
  ctx.drawImage(canvas2, 0, 0);
}

/**
 * @param {[number, number]} deltaPosition
 */
function onMove(deltaPosition) {
  /**
   * @type {[number, number]}
   */
  let scaledTranslate = [
    -deltaPosition[0] * resolutionInput.value,
    -deltaPosition[1] * resolutionInput.value,
  ];

  mandelbrotCoordSystem.moveOriginRelativeToViewport(...scaledTranslate);
  [realInput.value, imaginaryInput.value] = mandelbrotCoordSystem.fromViewport(
    canvas.width / 2,
    canvas.height / 2
  );
  onTransformation();
}

/**
 *
 * @param {[number, number]} eventPosition
 * @param {number} deltaZoom
 */
function onZoom(eventPosition, deltaZoom) {
  const zoomFactor = Math.pow(1.001, -deltaZoom);

  /**
   * @type {[number, number]}
   */
  const scaledPosition = [
    eventPosition[0] * resolutionInput.value,
    eventPosition[1] * resolutionInput.value,
  ];

  // scale
  mandelbrotCoordSystem.scaleAtViewportPosition(zoomFactor, ...scaledPosition);

  const spanX = mandelbrotCoordSystem.fromViewportDistance(canvas.width);
  const spanY = mandelbrotCoordSystem.fromViewportDistance(canvas.height);
  radiusInput.value = Math.min(spanX, spanY) / 2;

  // update position with difference
  [realInput.value, imaginaryInput.value] = mandelbrotCoordSystem.fromViewport(
    canvas.width / 2,
    canvas.height / 2
  );
  onTransformation();
}

// mouse wheel
canvas.addEventListener("wheel", (event) => {
  onZoom([event.clientX, event.clientY], event.deltaY);
});

// touchpad
canvas.addEventListener("touchmove", (event) => {
  if (event.touches.length === 2) {
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const touchPosition = [
      (touch1.clientX + touch2.clientX) / 2,
      (touch1.clientY + touch2.clientY) / 2,
    ];
    const distance = Math.sqrt(
      Math.pow(touch1.clientX - touch2.clientX, 2) +
        Math.pow(touch1.clientY - touch2.clientY, 2)
    );
    if (lastDistance) {
      onMove([
        lastTouchPosition[0] - touchPosition[0],
        lastTouchPosition[1] - touchPosition[1],
      ]);
      onZoom(
        [
          (touch1.clientX + touch2.clientX) / 2,
          (touch1.clientY + touch2.clientY) / 2,
        ],
        5 * (lastDistance - distance)
      );
    }
    lastTouchPosition = touchPosition;
    lastDistance = distance;
  } else if (event.touches.length == 1) {
    if (lastTouchPosition) {
      onMove([
        lastTouchPosition[0] - event.touches[0].clientX,
        lastTouchPosition[1] - event.touches[0].clientY,
      ]);
    }
    lastTouchPosition = [event.touches[0].clientX, event.touches[0].clientY];
  }
});

// touch release
canvas.addEventListener("touchend", (event) => {
  lastDistance = null;
  lastTouchPosition = null;
});

canvas.addEventListener("mousedown", (event) => {
  lastMousePosition = [event.clientX, event.clientY];
});

canvas.addEventListener("mousemove", (event) => {
  // check if mouse is down
  if (event.buttons === 1) {
    const distance = Math.sqrt(
      Math.pow(event.clientX - lastMousePosition[0], 2) +
        Math.pow(event.clientY - lastMousePosition[1], 2)
    );
    if (distance > 30) {
      onMove([
        lastMousePosition[0] - event.clientX,
        lastMousePosition[1] - event.clientY,
      ]);
      lastMousePosition = [event.clientX, event.clientY];
    }
  }
});

infoForm.addEventListener(
  "submit",
  (/** @type {{ preventDefault: () => void; }} */ event) => {
    event.preventDefault();
    loadMandelbrotCoordsFromForm();
    restartIterationWorkers();
  }
);
[
  "mousedown",
  "touchstart",
  "wheel",
  "touchmove",
  "mousemove",
  "touchend",
].forEach((event) => {
  infoForm.addEventListener(
    event,
    (/** @type {{ stopPropagation: () => void; }} */ event) => {
      event.stopPropagation();
    }
  );
});

hideOverlayButton.addEventListener("click", () => {
  infoForm.classList.remove("visible");
  showOverlayButton.style.display = "block";
});

showOverlayButton.addEventListener("click", () => {
  infoForm.classList.add("visible");
  showOverlayButton.style.display = "none";
});

resetButton.addEventListener("click", () => {
  resetMandelbrot();
  restartIterationWorkers();
});

showAdvancedButton.addEventListener("click", () => {
  if (infoForm.classList.contains("hide")) {
    infoForm.classList.remove("hide");
    showAdvancedButton.style.transform = "rotate(180deg)";
  } else {
    infoForm.classList.add("hide");
    showAdvancedButton.style.transform = "rotate(0deg)";
  }
});

/**
 * @param {number} posX
 * @param {number} posY
 * @param {string} text
 */
function showTooltip(posX, posY, text) {
  tooltip.classList.remove("hidden");
  tooltip.style.top = `${posY}px`;
  tooltip.style.left = `${posX}px`;
  tooltip.innerHTML = text;
}

let tooltipTimeout = null;
document.querySelectorAll(".question").forEach((questionMark) => {
  const questionMarkText = questionMark.getAttribute("tooltip") ?? "";
  questionMark.addEventListener("click", () => {
    // open tooltip for 5 seconds
    const rect = questionMark.getBoundingClientRect();
    showTooltip(rect.left + 20, rect.top + 20, questionMarkText);

    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      tooltip.classList.add("hidden");
    }, 5000);
  });
  questionMark.addEventListener("mouseover", () => {
    console.log("hover");
    if (tooltip.classList.contains("hidden")) {
      tooltip.classList.remove("hidden");
    }

    // set tooltip position to question mark
    const rect = questionMark.getBoundingClientRect();
    showTooltip(rect.left + 20, rect.top + 20, questionMarkText);
  });
  questionMark.addEventListener("mouseout", () => {
    tooltip.classList.add("hidden");
  });
});

let requestInterval;
/**
 * @param {number} fps
 */
function restartRequestInterval(fps) {
  if (requestInterval) clearInterval(requestInterval);
  requestInterval = setInterval(() => {
    requestAllWorkers();
  }, 1000 / fps);
}

fpsInput.onChange = (/** @type {number} */ fps) => {
  restartRequestInterval(fps);
};

initWorkers(threadsInput.value);
restartRequestInterval(fpsInput.value);
loadMandelbrotCoordsFromForm();
restartIterationWorkers();
