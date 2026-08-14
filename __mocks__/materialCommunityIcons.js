const React = require('react');
const { Text } = require('react-native');

module.exports = function MaterialCommunityIcons({ name, color, size }) {
  return React.createElement(Text, { style: { color, fontSize: size } }, name);
};
