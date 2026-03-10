const LEGACY_NODE_CACHE = new Map();

function cacheLegacyNode(key, selector, resolver) {
  const existing = LEGACY_NODE_CACHE.get(key);
  if (existing) {
    return existing;
  }

  const node = typeof resolver === "function" ? resolver() : document.querySelector(selector);
  if (!node) {
    return null;
  }

  LEGACY_NODE_CACHE.set(key, node);
  return node;
}

export function mountLegacyNode({ key, selector, target, reveal = false }) {
  if (!target) {
    return null;
  }

  const node = cacheLegacyNode(key || selector, selector);
  if (!node) {
    return null;
  }

  if (reveal) {
    node.removeAttribute("hidden");
  }

  target.appendChild(node);
  return node;
}

export function mountLegacyCardFromChild({ key, childSelector, target, reveal = false }) {
  if (!target) {
    return null;
  }

  const node = cacheLegacyNode(key || childSelector, childSelector, () => {
    const child = document.querySelector(childSelector);
    return child ? child.closest(".card") : null;
  });

  if (!node) {
    return null;
  }

  if (reveal) {
    node.removeAttribute("hidden");
  }

  target.appendChild(node);
  return node;
}

export function mountLegacyClosest({
  key,
  childSelector,
  closestSelector,
  target,
  reveal = false
}) {
  if (!target) {
    return null;
  }

  const cacheKey = key || `${childSelector}::${closestSelector}`;
  const node = cacheLegacyNode(cacheKey, childSelector, () => {
    const child = document.querySelector(childSelector);
    return child ? child.closest(closestSelector) : null;
  });

  if (!node) {
    return null;
  }

  if (reveal) {
    node.removeAttribute("hidden");
  }

  target.appendChild(node);
  return node;
}

export function mountLegacyStageBody({ key, stageId, target }) {
  if (!target) {
    return null;
  }

  const selector = `#stage-${stageId} .stage-body-new`;
  const node = cacheLegacyNode(key || selector, selector);
  if (!node) {
    return null;
  }

  node.removeAttribute("hidden");
  target.appendChild(node);
  return node;
}
