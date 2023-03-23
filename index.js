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
let img;

let zoomDebounceTime = 600;

// coordinate systems
const mandelbrotCoordSystem = new CoordSystem();

function resetMandelbrot() {
  mandelbrotCoordSystem.x = canvas.width / 2;
  mandelbrotCoordSystem.y = canvas.height / 2;
  mandelbrotCoordSystem.scale = Math.min(canvas.width, canvas.height) / 4;
  realInput.value = 0;
  imaginaryInput.value = 0;
  radiusInput.value = 2;
  img = ctx.createImageData(canvas.width, canvas.height);
}

/**
 *
 * @param {ArrayBufferLike} colorList
 */
function drawMandelbrot(colorList) {
  const imgData = new ImageData(
    new Uint8ClampedArray(colorList),
    canvas.width,
    canvas.height
  );
  ctx.putImageData(imgData, 0, 0);
}

let iterationWorker;

function stopIterationWorker() {
  if (iterationWorker) {
    iterationWorker.terminate();
    iterationWorker = null;
  }
}

function restartIterationWorker() {
  stopIterationWorker();

  iterationWorker = new Worker("iteration-worker.js", { type: "module" });

  iterationWorker.onmessage = (event) => {
    requestAnimationFrame(() => {
      iterationsLabel.innerHTML = event.data.currentIteration;
      drawMandelbrot(event.data.colorListBuffer);
      requestWorkerData();
    });
  };

  iterationWorker.addEventListener("error", (error) => {
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
  // depending on radiusInput.value
  let iterationsPerTick = Math.min(Math.ceil(1 / radiusInput.value), 30);

  const mandelbrotCoords = [
    mandelbrotCoordSystem.x,
    mandelbrotCoordSystem.y,
    mandelbrotCoordSystem.scale,
  ];

  iterationWorker.postMessage({
    canvasSize: [canvas.width, canvas.height],
    iterationsPerTick: iterationsPerTick,
    mandelbrotCoords: mandelbrotCoords,
    command: "start",
  });
  requestWorkerData();
}

let isMoving = false;

function onMoveStart() {
  isMoving = true;
  stopIterationWorker();
}

/**
 * @param {[number, number]} deltaPosition
 */
function onMove(deltaPosition) {
  /**
   * @type {[number, number]}
   */
  const translate = [-deltaPosition[0], -deltaPosition[1]];

  mandelbrotCoordSystem.moveOriginRelativeToViewport(...translate);
  [realInput.value, imaginaryInput.value] = mandelbrotCoordSystem.fromViewport(
    canvas.width / 2,
    canvas.height / 2
  );

  ctx.putImageData(img, 0, 0);
  ctx.translate(...translate);
  ctx.drawImage(canvas, 0, 0);
}

function onMoveEnd() {
  isMoving = false;
  restartIterationWorker();
  ctx.resetTransform();
}

let isZooming = false;

function onZoomStart() {
  isZooming = true;
  stopIterationWorker();
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

  /**
   * @type {[number, number]}
   */
  let translate = [
    eventPosition[0] * (1 - zoomFactor),
    eventPosition[1] * (1 - zoomFactor),
  ];

  ctx.translate(...translate);
  ctx.scale(zoomFactor, zoomFactor);
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(canvas, 0, 0);
}

function onZoomEnd() {
  restartIterationWorker();
  isZooming = false;
  ctx.resetTransform();
}

let wheelDebounceTimer;

// mouse wheel
document.addEventListener("wheel", (event) => {
  if (!isZooming) {
    onZoomStart();
  }
  onZoom([event.clientX, event.clientY], event.deltaY);

  // draw after some time without using the mouse wheel
  clearTimeout(wheelDebounceTimer);
  wheelDebounceTimer = setTimeout(() => {
    wheelDebounceTimer = null;
    onZoomEnd();
  }, zoomDebounceTime);
});

let lastDistance;
let lastTouchPosition;

// touchpad
document.addEventListener("touchmove", (event) => {
  if (event.touches.length === 2) {
    if (!isZooming) {
      onZoomStart();
      onMoveStart();
    }
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
      zoomDebounceTime = 300;
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
    if (!isMoving) {
      onMoveStart();
    }
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
document.addEventListener("touchend", (event) => {
  if (lastDistance || lastTouchPosition) {
    onZoomEnd();
    onMoveEnd();
    lastDistance = null;
    lastTouchPosition = null;
  }
});

// mouse drag
let isDragging = false;
let lastMousePosition;

document.addEventListener("mousedown", (event) => {
  lastMousePosition = [event.clientX, event.clientY];
});

document.addEventListener("mousemove", (event) => {
  // check if mouse is down
  if (event.buttons === 1) {
    if (!isDragging) {
      onMoveStart();
      isDragging = true;
    }
    onMove([
      lastMousePosition[0] - event.clientX,
      lastMousePosition[1] - event.clientY,
    ]);
    lastMousePosition = [event.clientX, event.clientY];
  }
});

document.addEventListener("mouseup", (event) => {
  if (isDragging) {
    isDragging = false;
    onMoveEnd();
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
  restartIterationWorker();
});

hideOverlayButton.addEventListener("click", () => {
  overlay.style.display = "none";
});

resetButton.addEventListener("click", () => {
  resetMandelbrot();
  onZoomEnd();
});

resetMandelbrot();
restartIterationWorker();
