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
let canvasHeight = document.body.clientHeight;
let aspectRatio = canvasWidth / canvasHeight;
let position = [Number(realInput.value), Number(imaginaryInput.value)];
let radius = Number(radiusInput.value);
let rRange = [
  position[0] - radius * aspectRatio,
  position[0] + radius * aspectRatio,
];
let iRange = [position[1] - radius, position[1] + radius];
let img;

let cList = [];
let zList = [];
let nList = [];

let currentDrawId = 0;

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

draw();

let wheelDebounce;

// mouse wheel
document.addEventListener("wheel", (event) => {
  // stop drawing
  currentDrawId++;

  // calculate new radius
  const oldRadius = Number(radiusInput.value);
  radius = oldRadius * (1 + event.deltaY / 1000);
  radiusInput.value = radius;

  const realSpan = 2 * oldRadius * aspectRatio;
  const imaginarySpan = 2 * oldRadius;

  // calculate new position with mouse position
  const mousePosition = [event.clientX, event.clientY];
  const mouseReal = rRange[0] + realSpan * (mousePosition[0] / canvasWidth);
  const mouseImaginary =
    iRange[0] + imaginarySpan * (mousePosition[1] / canvasHeight);

  const newRRange = [
    position[0] - radius * aspectRatio,
    position[0] + radius * aspectRatio,
  ];
  const newIRange = [position[1] - radius, position[1] + radius];
  const newRealSpan = 2 * radius * aspectRatio;
  const newImaginarySpan = 2 * radius;

  const newMouseReal =
    newRRange[0] + newRealSpan * (mousePosition[0] / canvasWidth);
  const newMouseImaginary =
    newIRange[0] + newImaginarySpan * (mousePosition[1] / canvasHeight);

  const realDiff = mouseReal - newMouseReal;
  const imaginaryDiff = mouseImaginary - newMouseImaginary;

  // update position
  realInput.value = Number(realInput.value) + realDiff;
  imaginaryInput.value = Number(imaginaryInput.value) + imaginaryDiff;

  // update values
  position = [Number(realInput.value), Number(imaginaryInput.value)];
  rRange = [
    position[0] - radius * aspectRatio,
    position[0] + radius * aspectRatio,
  ];
  iRange = [position[1] - radius, position[1] + radius];

  // draw after some time without using the mouse wheel
  clearTimeout(wheelDebounce);
  wheelDebounce = setTimeout(() => {
    wheelDebounce = null;
    draw();
  }, 1000);

  const zoomFactor = oldRadius / radius;
  ctx.putImageData(img, 0, 0);

  // get current canvas scale
  const transform = ctx.getTransform();
  const mouseCanvasPosition = [
    (mousePosition[0] - transform.e) / transform.a,
    (mousePosition[1] - transform.f) / transform.d,
  ];

  // zoom
  ctx.scale(zoomFactor, zoomFactor);

  const newTransform = ctx.getTransform();
  const newMouseCanvasPosition = [
    (mousePosition[0] - newTransform.e) / newTransform.a,
    (mousePosition[1] - newTransform.f) / newTransform.d,
  ];
  const translate = [
    newMouseCanvasPosition[0] - mouseCanvasPosition[0],
    newMouseCanvasPosition[1] - mouseCanvasPosition[1],
  ];
  ctx.translate(translate[0], translate[1]);
  ctx.drawImage(canvas, 0, 0);
});

infoForm.addEventListener("submit", (event) => {
  console.log("submit");
  event.preventDefault();
  draw();
});
