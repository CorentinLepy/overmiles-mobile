import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useOverMilesTheme } from "@/src/theme/use-overmiles-theme";

type SkeletonBlockProps = Readonly<{
  height: number;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function SkeletonBlock({ height, width = "100%", radius, style }: SkeletonBlockProps) {
  const theme = useOverMilesTheme();
  const opacity = useRef(new Animated.Value(0.58)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    opacity.stopAnimation();
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 720,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 720,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius ?? theme.radius.control,
          borderCurve: "continuous",
          backgroundColor: theme.color.surfaceMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}
