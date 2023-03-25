/**
 * Loads the key from url params
 *
 * @param {string} key
 */
export function loadKey(key) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(key);
}

/**
 * Puts the key into url params
 *
 * @param {string} key
 * @param {*} value
 */
export function putKey(key, value) {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.set(key, value);
  window.history.replaceState(
    {},
    "",
    `${window.location.pathname}?${urlParams}`
  );
}

/**
 * Adds the current url to the history
 */
export function addCurrentUrlToHistory() {
  window.history.pushState({}, "", window.location.href);
}
