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
      this.setValueWithoutUrl(Number(urlValue));
    } else {
      this.setValueWithoutUrl(defaultValue);
    }
    this.htmlElement.addEventListener("input", () => {
      this.value = this.value;
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
    this.setValueWithoutUrl(newValue);
    putKey(this.htmlElement.id, newValue);
  }

  setValueWithoutUrl(newValue) {
    this.htmlElement.value = newValue;
  }
}
