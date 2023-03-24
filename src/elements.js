import { $ } from "./query.js";

/**
 * @typedef {Object} NumberInput
 * @property {HTMLElement} htmlElement
 * @property {number} value
 */
export class NumberInput {
  /**
   * @type {HTMLElement}
   */
  htmlElement;

  constructor(elementId, defaultValue = 0) {
    this.htmlElement = $(elementId);
    this.value = defaultValue;
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
