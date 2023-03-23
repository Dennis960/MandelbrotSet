// html elements
const radiusInput = new NumberInput("radius");
const realInput = new NumberInput("real");
const imaginaryInput = new NumberInput("imaginary");

const iterationsLabel = $("iterations");
const infoForm = $("info-form");
const overlay = $("overlay");
const hideOverlayButton = $("hide-overlay-button");
const resetButton = $("reset-button");
const canvas = $("canvas");
const ctx = canvas.getContext("2d");

// default values
const escapeRadius = 10;
const escapeRadiusSquared = Math.pow(escapeRadius, 2);

const maxIterations = 5000;
canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;
let aspectRatio = canvas.width / canvas.height;
let img;

let cList = [];
let zList = [];
let nList = [];

let currentDrawId = 0;
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
}

function iterateEquation(pixelIndex, iterationAmount, drawId) {
  let zR = zList[pixelIndex][0];
  let zI = zList[pixelIndex][1];
  let sR = zR * zR;
  let sI = zI * zI;

  for (let i = 0; i < iterationAmount; i++) {
    if (drawId !== currentDrawId) {
      return;
    }
    if (sR + sI <= escapeRadiusSquared) {
      zI = 2 * zR * zI + cList[pixelIndex][1];
      zR = sR - sI + cList[pixelIndex][0];
      sR = zR * zR;
      sI = zI * zI;
      zList[pixelIndex] = [zR, zI];
      nList[pixelIndex] = nList[pixelIndex] + 1;
    }
  }
}

async function draw() {
  const drawId = ++currentDrawId;

  const mandelbrotTopLeft = mandelbrotCoordSystem.fromViewport(0, 0);
  const mandelbrotBottomRight = mandelbrotCoordSystem.fromViewport(
    canvas.width,
    canvas.height
  );

  const rRange = [mandelbrotTopLeft[0], mandelbrotBottomRight[0]];
  const iRange = [mandelbrotTopLeft[1], mandelbrotBottomRight[1]];

  let rStep = (rRange[1] - rRange[0]) / canvas.width;
  let iStep = (iRange[1] - iRange[0]) / canvas.height;
  cList = [];
  zList = [];
  nList = [];

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      cList.push([rRange[0] + x * rStep, iRange[0] + y * iStep]);
      zList.push([0, 0]);
      nList.push(0);
    }
  }

  img = ctx.createImageData(canvas.width, canvas.height);
  let currentIteration = 1;

  async function drawMandelbrot() {
    for (let pixelIndex = 0; pixelIndex < cList.length; pixelIndex++) {
      let value = Math.pow(nList[pixelIndex] / currentIteration, 1) * 255;
      const color = [value, value, value, 255];
      img.data[pixelIndex * 4 + 0] = color[0];
      img.data[pixelIndex * 4 + 1] = color[1];
      img.data[pixelIndex * 4 + 2] = color[2];
      img.data[pixelIndex * 4 + 3] = color[3];
    }
    ctx.putImageData(img, 0, 0);
  }

  // depending on radiusInput.value
  let iterationsPerTick = Math.min(Math.ceil(1 / radiusInput.value), 30);

  for (
    ;
    currentIteration <= maxIterations;
    currentIteration += iterationsPerTick
  ) {
    iterationsLabel.innerHTML = currentIteration;
    for (let pixelIndex = 0; pixelIndex < cList.length; pixelIndex++) {
      iterateEquation(pixelIndex, iterationsPerTick, drawId);
    }
    if (drawId !== currentDrawId) {
      return;
    }
    drawMandelbrot();
    // let the browser draw the image
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  iterationsPerTick = Math.floor(iterationsPerTick * 1.5);
}

let isMoving = false;

function onMoveStart() {
  isMoving = true;
  // stop drawing
  currentDrawId++;
}

function onMove(deltaPosition) {
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
  draw();
  ctx.resetTransform();
}

let isZooming = false;

function onZoomStart() {
  // stop drawing
  currentDrawId++;
  isZooming = true;
}

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
  draw();
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
  draw();
});

infoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  draw();
});

hideOverlayButton.addEventListener("click", () => {
  overlay.style.display = "none";
});

resetButton.addEventListener("click", () => {
  resetMandelbrot();
  onZoomEnd();
});

resetMandelbrot();
draw();
