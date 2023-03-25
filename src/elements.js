import { $ } from "./query.js";
import { loadKey, putKey } from "./url-state.js";

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
    const urlValue = loadKey(elementId);
    if (urlValue !== null) {
      this.htmlElement.value = urlValue;
    } else {
      this.htmlElement.value = defaultValue;
    }
    this.htmlElement.addEventListener("input", () => {
      putKey(this.htmlElement.id, this.value);
    });
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
    putKey(this.htmlElement.id, newValue);
  }
}
