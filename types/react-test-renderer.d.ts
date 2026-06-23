// react-test-renderer ships no bundled @types in this project; it is available at
// runtime via expo / react-native (jest uses it through the RN preset). This
// shorthand ambient declaration lets `tsc --noEmit` resolve the import as `any`.
declare module 'react-test-renderer';
