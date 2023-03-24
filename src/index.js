// @ts-check

import { CoordSystem } from "./coord-system.js";
import { NumberInput } from "./elements.js";
import { $ } from "./query.js";

// html elements
const radiusInput = new NumberInput("radius");
const realInput = new NumberInput("real");
const imaginaryInput = new NumberInput("imaginary");

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

let transformationDebounceTime = 600;

// coordinate systems
const mandelbrotCoordSystem = new CoordSystem();

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
}

let lastMandelbrotCoordSystem = null;

/**
 *
 * @param {ArrayBufferLike} colorList
 */
function drawMandelbrot(colorList) {
  if (transformationDebounceTimeout) {
    // transformation is still in progress
    return;
  }
  imgData = new ImageData(
    new Uint8ClampedArray(colorList),
    canvas.width,
    canvas.height
  );
  ctx.putImageData(imgData, 0, 0);
}

const iterationWorker = new Worker("./src/iteration-worker.js", {
  type: "module",
});

function restartIterationWorker() {
  iterationWorker.onmessage = (event) => {
    iterationsLabel.innerHTML = event.data.currentIteration;
    drawMandelbrot(event.data.colorListBuffer);
    requestAnimationFrame(() => {
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
    if (!iterationWorker) {
      return;
    }
    iterationWorker.postMessage({
      command: "request",
    });
  }

  const mandelbrotCoords = [
    mandelbrotCoordSystem.x,
    mandelbrotCoordSystem.y,
    mandelbrotCoordSystem.scale,
  ];

  lastMandelbrotCoordSystem = mandelbrotCoordSystem.clone();

  iterationWorker.postMessage({
    canvasSize: [canvas.width, canvas.height],
    mandelbrotCoords: mandelbrotCoords,
    command: "start",
  });
  requestWorkerData();
}

let transformationDebounceTimeout = null;

function onTransformation() {
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
  ctx.translate(left2, top2);
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(canvas2, 0, 0);

  if (transformationDebounceTimeout) {
    clearTimeout(transformationDebounceTimeout);
  }
  transformationDebounceTimeout = setTimeout(() => {
    restartIterationWorker();
    transformationDebounceTimeout = null;
  }, transformationDebounceTime);
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

let lastDistance;
let lastTouchPosition;

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

// mouse drag
let lastMousePosition;

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
  "mouseup",
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
});

resetMandelbrot();
restartIterationWorker();
