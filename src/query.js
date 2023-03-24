/**
 *
 * @param {string} id
 * @returns {T extends HTMLElement}
 */
export function $(id) {
  return document.getElementById(id);
}
