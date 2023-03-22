function $(id) {
  return document.getElementById(id);
}

const canvas = $("canvas");
const iterationsLabel = $("iterations");
const radiusInput = $("radius");
const realInput = $("real");
const imaginaryInput = $("imaginary");
const infoForm = $("info-form");

const ctx = canvas.getContext("2d");

const escapeRadius = 10;
const escapeRadiusSquared = Math.pow(escapeRadius, 2);

const maxIterations = 5000;
let canvasWidth = document.body.clientWidth;
let canvasHeight = navigator.userAgent.mobile
  ? document.body.clientHeight - 100
  : document.body.clientHeight;
let aspectRatio = canvasWidth / canvasHeight;
let img;

let cList = [];
let zList = [];
let nList = [];

let currentDrawId = 0;
const zoomDebounceTime = navigator.userAgentData.mobile ? 300 : 600;

function loadValues() {
  position = [Number(realInput.value), Number(imaginaryInput.value)];
  radius = Number(radiusInput.value);
  rRange = [
    position[0] - radius * aspectRatio,
    position[0] + radius * aspectRatio,
  ];
  iRange = [position[1] - radius, position[1] + radius];
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

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  let rStep = (rRange[1] - rRange[0]) / canvasWidth;
  let iStep = (iRange[1] - iRange[0]) / canvasHeight;
  cList = [];
  zList = [];
  nList = [];

  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
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

  // depending on radius
  let iterationsPerTick = Math.min(Math.ceil(1 / radius), 30);

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

let zoomDebounceTimer;

function onZoom(eventPosition, deltaZoom, deltaPosition = [0, 0]) {
  if (deltaZoom < -900) {
    deltaZoom = -900;
  }
  currentDrawId++;

  // calculate new radius
  const oldRadius = Number(radiusInput.value);
  radius = oldRadius * (1 + deltaZoom / 1000);
  radiusInput.value = radius;

  const realSpan = 2 * oldRadius * aspectRatio;
  const imaginarySpan = 2 * oldRadius;

  // calculate new position with mouse position
  const mouseReal = rRange[0] + realSpan * (eventPosition[0] / canvasWidth);
  const mouseImaginary =
    iRange[0] + imaginarySpan * (eventPosition[1] / canvasHeight);

  // calculate new ranges and spans
  const newRRange = [
    position[0] - radius * aspectRatio,
    position[0] + radius * aspectRatio,
  ];
  const newIRange = [position[1] - radius, position[1] + radius];
  const newRealSpan = 2 * radius * aspectRatio;
  const newImaginarySpan = 2 * radius;

  // calculate new mouse position with new ranges and spans
  const newMouseReal =
    newRRange[0] +
    newRealSpan * ((eventPosition[0] - deltaPosition[0]) / canvasWidth);
  const newMouseImaginary =
    newIRange[0] +
    newImaginarySpan * ((eventPosition[1] - deltaPosition[1]) / canvasHeight);

  // calculate difference
  const realDiff = mouseReal - newMouseReal;
  const imaginaryDiff = mouseImaginary - newMouseImaginary;

  // update position with difference
  realInput.value = Number(realInput.value) + realDiff;
  imaginaryInput.value = Number(imaginaryInput.value) + imaginaryDiff;

  // update values
  loadValues();

  // draw after some time without using the mouse wheel
  clearTimeout(zoomDebounceTimer);
  zoomDebounceTimer = setTimeout(() => {
    zoomDebounceTimer = null;
    draw();
  }, zoomDebounceTime);

  const zoomFactor = oldRadius / radius;
  ctx.putImageData(img, 0, 0);

  // get current canvas scale
  const transform = ctx.getTransform();
  const mouseCanvasPosition = [
    (eventPosition[0] - transform.e) / transform.a,
    (eventPosition[1] - transform.f) / transform.d,
  ];

  // zoom
  ctx.scale(zoomFactor, zoomFactor);

  const newTransform = ctx.getTransform();
  const newMouseCanvasPosition = [
    (eventPosition[0] - newTransform.e) / newTransform.a,
    (eventPosition[1] - newTransform.f) / newTransform.d,
  ];
  const translate = [
    newMouseCanvasPosition[0] - mouseCanvasPosition[0] - deltaPosition[0],
    newMouseCanvasPosition[1] - mouseCanvasPosition[1] - deltaPosition[1],
  ];
  ctx.translate(translate[0], translate[1]);
  ctx.drawImage(canvas, 0, 0);
}

// mouse wheel
document.addEventListener("wheel", (event) => {
  onZoom([event.clientX, event.clientY], event.deltaY);
});

let lastDistance;
let lastTouchPosition;

// touchpad
document.addEventListener("touchmove", (event) => {
  if (event.touches.length === 2) {
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const touchPosition = [
      (touch1.clientX + touch2.clientX) / 2,
      (touch1.clientY + touch2.clientY) / 2,
    ];
    const distance =
      5 *
      Math.sqrt(
        Math.pow(touch1.clientX - touch2.clientX, 2) +
          Math.pow(touch1.clientY - touch2.clientY, 2)
      );
    if (lastDistance) {
      onZoom(
        [
          (touch1.clientX + touch2.clientX) / 2,
          (touch1.clientY + touch2.clientY) / 2,
        ],
        lastDistance - distance,
        lastTouchPosition
          ? [
              lastTouchPosition[0] - touchPosition[0],
              lastTouchPosition[1] - touchPosition[1],
            ]
          : [0, 0]
      );
    }
    lastTouchPosition = touchPosition;
    lastDistance = distance;
  }
});

// touch release
document.addEventListener("touchend", (event) => {
  lastDistance = null;
  lastTouchPosition = null;
});

infoForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loadValues();
  draw();
});

loadValues();
draw();
