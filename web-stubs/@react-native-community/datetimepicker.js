/**
 * @react-native-community/datetimepicker is a native UI component (native
 * date / time spinner backed by UIDatePicker / Calendar). It has no web
 * implementation and imports a native module at top level, so it crashes the
 * web bundle. On web we fall back to a plain <input type="date|time"> so the
 * onboarding / time-picker screens still render and the React tree mounts.
 */
const React = require('react');

function toIso(d) {
  if (!d) return '';
  try {
    return new Date(d).toISOString().slice(0, 16);  // local-ish "yyyy-mm-ddTHH:MM"
  } catch {
    return '';
  }
}

function DateTimePicker(props) {
  const mode = props.mode || 'date';
  const inputType = mode === 'time' ? 'time' : mode === 'datetime' ? 'datetime-local' : 'date';

  const onChange = (e) => {
    if (typeof props.onChange !== 'function') return;
    const value = e && e.target ? e.target.value : '';
    const date = value ? new Date(value) : undefined;
    // Match the native signature: (event, date?)
    props.onChange({ type: 'set', nativeEvent: { timestamp: date ? date.getTime() : 0 } }, date);
  };

  const value = props.value instanceof Date ? props.value : props.value ? new Date(props.value) : new Date();
  const stringValue = mode === 'time' ? value.toISOString().slice(11, 16) : toIso(value);

  return React.createElement('input', {
    type: inputType,
    value: stringValue,
    onChange,
    style: props.style,
    'aria-label': props.accessibilityLabel || 'date-time picker',
  });
}

DateTimePicker.displayName = 'DateTimePickerWebStub';

module.exports = DateTimePicker;
module.exports.default = DateTimePicker;
module.exports.__esModule = true;
