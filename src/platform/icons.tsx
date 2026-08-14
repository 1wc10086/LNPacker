import React from 'react';
import { Text } from 'react-native';

type Props = { name: string; color?: string; size?: number; style?: object; allowFontScaling?: boolean; selectable?: boolean; pointerEvents?: string; testID?: string };

function loadIcon() {
  try {
    const module = require('@expo/vector-icons/MaterialCommunityIcons');
    return module.default ?? module;
  } catch {
    return null;
  }
}

const Icon = loadIcon();

export default function MaterialCommunityIcons(props: Props) {
  if (!Icon) return <Text style={[{ color: props.color, fontSize: props.size }, props.style]}>{'\u25A1'}</Text>;
  return <Icon {...props} />;
}
