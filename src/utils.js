export function isEmpty(string) {
  return [undefined, null, NaN, ''].indexOf(string) > -1;
}

export function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function cloneAttrs(model, attrs, excludeAttrs) {
  const clone = {};
  const attributes = model.attributes;
  for (const p in attributes) {
    if (excludeAttrs.indexOf(p) > -1) continue;
    const nestedClone = {};
    const attribute = attributes[p];
    for (const np in attribute) {
      if (attrs.indexOf(np) > -1) {
        nestedClone[np] = attribute[np];
      }
    }
    clone[p] = nestedClone;
  }
  return clone;
}
