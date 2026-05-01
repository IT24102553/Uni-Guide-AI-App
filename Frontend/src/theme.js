import { Dimensions, Platform } from "react-native";

const { width } = Dimensions.get("window");
const isIphone14Width = width <= 430;

export const colors = {
  primary: "#1f1a6f",
  secondary: "#6b38d4",
  background: "#f7f9fb",
  surface: "#ffffff",
  surfaceAlt: "#eceef0",
  text: "#191c1e",
  textMuted: "#464652",
  outline: "#c7c5d4",
  footer: "#363386",
};

export const layout = {
  screenPadding: isIphone14Width ? 16 : 20,
  compactPadding: isIphone14Width ? 14 : 16,
  cardPadding: isIphone14Width ? 16 : 20,
  sectionGap: isIphone14Width ? 12 : 16,
  pageGap: isIphone14Width ? 14 : 18,
  cardRadius: 16,
  pillRadius: 999,
  touchTarget: 44,
  notchClearance: Platform.OS === "ios" ? 10 : 6,
  topBarHeight: Platform.OS === "ios" ? 58 : 54,
  imageHeight: isIphone14Width ? 170 : 190,
  heroImageHeight: isIphone14Width ? 220 : 280,
  tabBarBaseHeight: Platform.OS === "ios" ? 58 : Platform.OS === "web" ? 72 : 64,
  tabBarTopPadding: Platform.OS === "web" ? 9 : 7,
  tabBarBottomPadding: Platform.OS === "ios" ? 12 : Platform.OS === "web" ? 8 : 10,
};

export const type = {
  hero: isIphone14Width ? 31 : 36,
  heroLine: isIphone14Width ? 37 : 42,
  h1: isIphone14Width ? 30 : 34,
  h2: isIphone14Width ? 25 : 30,
  h3: isIphone14Width ? 20 : 24,
  body: 15,
  small: 12,
};
