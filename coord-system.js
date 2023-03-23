/**
 * Coordinate System with origin coordinates relative to the viewport
 * Scale relative to the viewport (scale of 1 means 1 pixel = 1 unit)
 *
 * @property {number} x  x coordinate of the origin relative to the viewport
 * @property {number} y  y coordinate of the origin relative to the viewport
 * @property {number} scale  Scale relative to the viewport (scale of 1 means 1 pixel = 1 unit)
 * Also the number of units per pixel
 */
class CoordSystem {
  /**
   * x coordinate of the origin relative to the viewport
   */
  x;
  /**
   * y coordinate of the origin relative to the viewport
   */
  y;
  /**
   * Scale relative to the viewport (scale of 1 means 1 pixel = 1 unit)
   * Also the number of units per pixel
   */
  scale;

  constructor(x = 0, y = 0, scale = 1) {
    this.set(x, y, scale);
  }

  /**
   * Sets the coordinate system to the given values
   *
   * @param {number} x
   * @param {number} y
   * @param {number} scale
   */
  set(x, y, scale) {
    this.x = x;
    this.y = y;
    this.scale = scale;
  }

  /**
   * Moves the coordinate system by the given amount relative to the viewport
   *
   * @param {number} movX  x movement in pixels
   * @param {number} movY  y movement in pixels
   */
  moveOriginRelativeToViewport(movX, movY) {
    this.x += movX;
    this.y += movY;
  }

  /**
   * Moves the coordinate system by the given amount relative to itself
   *
   * @param {number} movX  x movement in units
   * @param {number} movY  y movement in units
   */
  moveOriginRelativeToSelf(movX, movY) {
    this.x += movX * this.scale;
    this.y += movY * this.scale;
  }

  /**
   * Scales the coordinate system by the given amount
   *
   * @param {number} scaleFactor
   */
  scaleByFactor(scaleFactor) {
    this.scale *= scaleFactor;
  }

  /**
   * Scales the coordinate system by the given amount at the given position relative to the viewport
   *
   * @param {number} scaleFactor  zoom factor
   * @param {number} x  x coordinate relative to the viewport
   * @param {number} y  y coordinate relative to the viewport
   */
  scaleAtViewportPosition(scaleFactor, x, y) {
    const [x1, y1] = this.fromViewport(x, y);
    this.scaleByFactor(scaleFactor);
    const [x2, y2] = this.fromViewport(x, y);
    this.moveOriginRelativeToSelf(x2 - x1, y2 - y1);
  }

  /**
   *
   * @param {number} x  x coordinate relative to the viewport
   * @param {number} y  y coordinate relative to the viewport
   * @returns {number[]} [x, y] in the coordinate system
   */
  fromViewport(x, y) {
    return [(x - this.x) / this.scale, (y - this.y) / this.scale];
  }

  /**
   * Converts coordinates from the coordinate system to the viewport
   *
   * @param {number} x  x coordinate in the coordinate system
   * @param {number} y  y coordinate in the coordinate system
   * @returns {number[]} [x, y] in the viewport
   */
  toViewport(x, y) {
    return [x * this.scale + this.x, y * this.scale + this.y];
  }

  /**
   * Converts coordinates from one coordinate system to another
   *
   * @param {number} x
   * @param {number} y
   * @param {CoordSystem} otherCoordSystem
   * @returns {number[]} [x, y] in the other coordinate system
   */
  fromCoordSystem(x, y, otherCoordSystem) {
    const [x1, y1] = this.toViewport(x, y);
    return otherCoordSystem.fromViewport(x1, y1);
  }

  /**
   * Gets the distance between two points in the coordinate system
   *
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {number} distance between the two points in the coordinate system
   */
  distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
  }

  /**
   * Gets the distance between two points in the viewport
   *
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {number} distance between the two points in the viewport
   */
  distanceInViewport(x1, y1, x2, y2) {
    return this.distance(
      ...this.fromViewport(x1, y1),
      ...this.fromViewport(x2, y2)
    );
  }

  /**
   *
   * @param {number} dist
   * @returns {number} distance from the viewport converted to distance in the coordinate system
   */
  fromViewportDistance(dist) {
    return dist / this.scale;
  }

  /**
   * Clones the coordinate system
   *
   * @returns {CoordSystem} a copy of the coordinate system
   */
  clone() {
    return new CoordSystem(this.x, this.y, this.scale);
  }

  /**
   * Copies the values from another coordinate system
   *
   * @param {CoordSystem} otherCoordSystem
   */
  cloneFrom(otherCoordSystem) {
    this.set(otherCoordSystem.x, otherCoordSystem.y, otherCoordSystem.scale);
  }
}
