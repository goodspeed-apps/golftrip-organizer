// Minimal nativewind/jsx-runtime mock — pass through to React's jsx-runtime.
// jsx(type, props, key) signature: children are in props.children; key is separate.
// We must NOT pass key as a positional arg to createElement (it would become children).
const React = require('react');

function jsx(type, props, key) {
  const { children, ...rest } = props || {};
  if (key !== undefined) {
    rest.key = key;
  }
  return children !== undefined
    ? React.createElement(type, rest, ...(Array.isArray(children) ? children : [children]))
    : React.createElement(type, rest);
}

module.exports = {
  jsx,
  jsxs: jsx,
  Fragment: React.Fragment,
};
