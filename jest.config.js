module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '\\.(ttf|otf)$': '<rootDir>/__mocks__/fontMock.js',
    '^@expo/vector-icons/MaterialCommunityIcons$': '<rootDir>/__mocks__/materialCommunityIcons.js',
    '^@pchmn/expo-material3-theme$': '<rootDir>/__mocks__/material3Theme.js',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expoFileSystem.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expoSharing.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/asyncStorage.js',
  },
  transformIgnorePatterns: ['node_modules/(?!((@)?react-native|@react-native|@expo|expo(nent)?|@noble|css-select|domutils|domhandler|htmlparser2|dom-serializer|domelementtype|entities|boolbase|css-what|nth-check)/)'],
};
