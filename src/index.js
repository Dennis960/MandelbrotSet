// @ts-check

import { CoordSystem } from "./coord-system.js";
import { NumberInput } from "./elements.js";
import { $ } from "./query.js";
import { addCurrentUrlToHistory } from "./url-state.js";

// html inputs
const radiusInput = new NumberInput("radius", 2);
const realInput = new NumberInput("real", 0);
const imaginaryInput = new NumberInput("imaginary", 0);
const iterationAmountInput = new NumberInput("iteration-amount", 10);
const colorSchemeSelect = new NumberInput("color-scheme", 1);

// html elements
const iterationsLabel = $("iterations");
const infoForm = $("info-form");
const overlay = $("overlay");
const hideOverlayButton = $("hide-overlay-button");
const resetButton = $("reset-button");
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

let transformationDebounceTime = 600;
let transformationDebounceTimeout = null;

let lastDistance;
let lastTouchPosition;
let lastMousePosition;

function loadMandelbrotCoordsFromForm() {
  mandelbrotCoordSystem.scale =
    Math.min(canvas.width, canvas.height) / 2 / radiusInput.value;
  mandelbrotCoordSystem.x =
    canvas.width / 2 - realInput.value * mandelbrotCoordSystem.scale;
  mandelbrotCoordSystem.y =
    canvas.height / 2 - imaginaryInput.value * mandelbrotCoordSystem.scale;
}

function resetMandelbrot() {
  mandelbrotCoordSystem.x = canvas.width / 2;
  mandelbrotCoordSystem.y = canvas.height / 2;
  mandelbrotCoordSystem.scale = Math.min(canvas.width, canvas.height) / 4;
  realInput.value = 0;
  imaginaryInput.value = 0;
  radiusInput.value = 2;
  iterationAmountInput.value = 10;
  colorSchemeSelect.value = 0;
}

/**
 * @param {ArrayBufferLike} colorListBuffer
 */
function drawMandelbrot(colorListBuffer) {
  if (colorListBuffer.byteLength - canvas.width * canvas.height * 4 !== 0) {
    // buffer size does not match canvas size
    return;
  }
  if (transformationDebounceTimeout) return;
  imgData = new ImageData(
    new Uint8ClampedArray(colorListBuffer),
    canvas.width,
    canvas.height
  );
  ctx.putImageData(imgData, 0, 0);
}

const iterationWorker = new Worker("./src/iteration-worker.js", {
  type: "module",
});

iterationWorker.onmessage = (event) => {
  iterationsLabel.innerHTML = event.data.currentIteration;
  drawMandelbrot(event.data.colorListBuffer);
  requestAnimationFrame(() => {
    if (transformationDebounceTimeout) return;
    requestWorkerData();
  });
};

iterationWorker.addEventListener("error", (error) => {
  console.error(error);
});
iterationWorker.addEventListener("messageerror", (error) => {
  console.error(error);
});

function requestWorkerData() {
  iterationWorker.postMessage({
    command: "request",
    colorScheme: colorSchemeSelect.value,
  });
}

function restartIterationWorker() {
  const mandelbrotCoords = [
    mandelbrotCoordSystem.x,
    mandelbrotCoordSystem.y,
    mandelbrotCoordSystem.scale,
  ];

  iterationWorker.postMessage({
    canvasSize: [canvas.width, canvas.height],
    mandelbrotCoords: mandelbrotCoords,
    iterationsPerTick: iterationAmountInput.value,
    command: "start",
  });
}

function onTransformation() {
  if (transformationDebounceTimeout) {
    clearTimeout(transformationDebounceTimeout);
  } else {
    addCurrentUrlToHistory();
    lastMandelbrotCoordSystem = mandelbrotCoordSystem.clone();
    iterationWorker.postMessage({
      command: "stop",
    });
  }
  transformationDebounceTimeout = setTimeout(() => {
    restartIterationWorker();
    transformationDebounceTimeout = null;
  }, transformationDebounceTime);

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
  let translate = [-deltaPosition[0], -deltaPosition[1]];

  mandelbrotCoordSystem.moveOriginRelativeToViewport(...translate);
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

  // scale
  mandelbrotCoordSystem.scaleAtViewportPosition(zoomFactor, ...eventPosition);

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
      transformationDebounceTime = 300;
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
    onMove([
      lastMousePosition[0] - event.clientX,
      lastMousePosition[1] - event.clientY,
    ]);
    lastMousePosition = [event.clientX, event.clientY];
  }
});

// listener when window is resized
window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  resetMandelbrot();
  restartIterationWorker();
});

infoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadMandelbrotCoordsFromForm();
  restartIterationWorker();
});
[
  "mousedown",
  "touchstart",
  "wheel",
  "touchmove",
  "mousemove",
  "touchend",
].forEach((event) => {
  infoForm.addEventListener(event, (event) => {
    event.stopPropagation();
  });
});

hideOverlayButton.addEventListener("click", () => {
  overlay.style.display = "none";
});

resetButton.addEventListener("click", () => {
  resetMandelbrot();
  restartIterationWorker();
});

loadMandelbrotCoordsFromForm();
restartIterationWorker();
