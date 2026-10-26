import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

const BRAND_RED = '#ff4a4a';
const EYE_L = 42;
const EYE_R = 78;
const EYE_Y = 52;
const TRACK_SPAN = 14;

/** Minimal peek buddy — hands cover when hidden; eyes follow typing when revealed. */
export default function PasswordPeekBuddy({ value = '', revealed = false }) {
  const handsCover = !revealed;

  const { pupilX, pupilY } = useMemo(() => {
    const len = value.length;
    const progress = len === 0 ? 0 : Math.min(len / TRACK_SPAN, 1);
    return {
      pupilX: -2.5 + progress * 5,
      pupilY: revealed ? 3.5 + progress * 1 : 0,
    };
  }, [value.length, revealed]);

  const handY = handsCover ? 49 : 86;
  const handSize = handsCover ? 13 : 11;

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.face}>
        <Svg viewBox="0 0 120 120" width="100%" height="100%">
          <Circle cx="30" cy="66" r="5" fill={BRAND_RED} opacity={0.14} />
          <Circle cx="90" cy="66" r="5" fill={BRAND_RED} opacity={0.14} />

          <Circle cx={EYE_L} cy={EYE_Y} r="9" fill="#fff" stroke="#ececec" strokeWidth="0.75" />
          <Circle cx={EYE_R} cy={EYE_Y} r="9" fill="#fff" stroke="#ececec" strokeWidth="0.75" />

          {handsCover ? (
            <>
              <Path
                d={`M ${EYE_L - 8} ${EYE_Y + 2} Q ${EYE_L} ${EYE_Y + 6} ${EYE_L + 8} ${EYE_Y + 2}`}
                stroke="#c4c4c4"
                strokeWidth="1.75"
                fill="none"
                strokeLinecap="round"
              />
              <Path
                d={`M ${EYE_R - 8} ${EYE_Y + 2} Q ${EYE_R} ${EYE_Y + 6} ${EYE_R + 8} ${EYE_Y + 2}`}
                stroke="#c4c4c4"
                strokeWidth="1.75"
                fill="none"
                strokeLinecap="round"
              />
            </>
          ) : (
            <G transform={`translate(${pupilX} ${pupilY})`}>
              <Circle cx={EYE_L} cy={EYE_Y} r="3.5" fill="#3d3d3d" />
              <Circle cx={EYE_L - 1.2} cy={EYE_Y - 1.2} r="1" fill="#fff" opacity={0.85} />
              <Circle cx={EYE_R} cy={EYE_Y} r="3.5" fill="#3d3d3d" />
              <Circle cx={EYE_R - 1.2} cy={EYE_Y - 1.2} r="1" fill="#fff" opacity={0.85} />
            </G>
          )}

          <Path
            d={handsCover ? 'M 52 74 Q 60 70 68 74' : 'M 53 73 Q 60 78 67 73'}
            stroke={BRAND_RED}
            strokeWidth="1.75"
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />

          <Ellipse
            cx={handsCover ? 28 : 16}
            cy={handY}
            rx={handSize}
            ry={handSize * 0.78}
            fill={BRAND_RED}
            opacity={0.18}
          />
          <Ellipse
            cx={handsCover ? 92 : 104}
            cy={handY}
            rx={handSize}
            ry={handSize * 0.78}
            fill={BRAND_RED}
            opacity={0.18}
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 8 },
  face: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 1,
    borderColor: 'rgba(255,74,74,0.12)',
    backgroundColor: '#fffafa',
    overflow: 'hidden',
  },
});
