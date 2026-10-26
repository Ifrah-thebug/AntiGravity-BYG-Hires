import { Platform } from 'react-native';

/**
 * Web uses Montserrat. Drop the Montserrat TTFs into src/assets/fonts and run
 * `npx react-native-asset` to link them; until then we fall back to the system font.
 */
const family = Platform.select({ ios: 'System', android: undefined });

export const fonts = {
  regular: { fontFamily: family, fontWeight: '400' },
  medium: { fontFamily: family, fontWeight: '500' },
  semibold: { fontFamily: family, fontWeight: '600' },
  bold: { fontFamily: family, fontWeight: '700' },
  extrabold: { fontFamily: family, fontWeight: '800' },
  black: { fontFamily: family, fontWeight: '900' },
};

/** Common text presets used across screens (match the web's tracking-widest labels). */
export const type = {
  eyebrow: { ...fonts.black, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
  label: { ...fonts.bold, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  button: { ...fonts.black, fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' },
  buttonSmall: { ...fonts.black, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  h1: { ...fonts.black, fontSize: 30, letterSpacing: -0.5 },
  h2: { ...fonts.black, fontSize: 22, letterSpacing: -0.3 },
  h3: { ...fonts.black, fontSize: 17, letterSpacing: -0.2 },
  body: { ...fonts.medium, fontSize: 14, lineHeight: 21 },
  small: { ...fonts.medium, fontSize: 12, lineHeight: 17 },
  tiny: { ...fonts.semibold, fontSize: 11, lineHeight: 15 },
};
