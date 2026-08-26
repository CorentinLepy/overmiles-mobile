import { useColorScheme } from "react-native";

import { darkTheme, theme } from "./tokens";

export function useOverMilesTheme() {
  return useColorScheme() === "dark" ? darkTheme : theme;
}
