// @ts-check

import { $ } from "./query.js";
import { loadKey, putKey } from "./url-state.js";

/**
 * @property {HTMLElement} htmlElement
 * @property {number} value
 */
export class NumberInput {
  /**
   * @type {HTMLInputElement}
   */
  htmlElement;

  /**
   * Callback for when the value changes
   * @type {((newValue: number) => void) | undefined}
   */
  onChange;

  /**
   *
   * @param {String} elementId
   * @param {number} defaultValue
   */
  constructor(elementId, defaultValue = 0) {
    this.htmlElement = $(elementId);
    const urlValue = loadKey(elementId);
    if (urlValue !== null) {
      this.htmlElement.value = urlValue;
    } else {
      this.htmlElement.value = defaultValue.toString();
    }
    this.htmlElement.addEventListener("input", () => {
      putKey(this.htmlElement.id, this.value);
      if (this.onChange) this.onChange(this.value);
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
    if (this.onChange) this.onChange(newValue);
    this.htmlElement.value = newValue.toString();
    putKey(this.htmlElement.id, newValue);
  }
}
