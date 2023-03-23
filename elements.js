/**
 * @typedef {Object} NumberInput
 * @property {HTMLElement} htmlElement
 * @property {number} value
 */
class NumberInput {
  /**
   * @type {HTMLElement}
   */
  htmlElement;

  constructor(elementId) {
    this.htmlElement = $(elementId);
  }

  /**
   * @returns {number}
   */
  get value() {
    return Number(this.htmlElement.value);
  }

  /**
   * @param {number} newValue
   */
  set value(newValue) {
    this.htmlElement.value = newValue;
  }
}
