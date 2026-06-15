import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const BRAND_RED = '#ff4a4a';
const EYE_L = 42;
const EYE_R = 78;
const EYE_Y = 52;
const TRACK_SPAN = 14;

/**
 * Minimal peek buddy — hands cover when hidden; eyes glance down-left → down-right while typing.
 */
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

  const handCover = { y: 49, size: 13 };
  const handRest = { y: 86, size: 11 };

  return (
    <div className="flex justify-center py-2" aria-hidden>
      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      >
        <div
          className="relative w-[7.25rem] h-[7.25rem] rounded-full border shadow-[0_6px_24px_rgba(255,74,74,0.08)]"
          style={{
            background: 'linear-gradient(160deg, #ffffff 0%, #fffafa 50%, #fff5f5 100%)',
            borderColor: 'rgba(255, 74, 74, 0.12)',
          }}
        >
          <svg viewBox="0 0 120 120" className="w-full h-full">
            {/* Symmetric blush */}
            <circle cx="30" cy="66" r="5" fill={BRAND_RED} opacity="0.14" />
            <circle cx="90" cy="66" r="5" fill={BRAND_RED} opacity="0.14" />

            {/* Eye whites */}
            <circle cx={EYE_L} cy={EYE_Y} r="9" fill="#fff" stroke="#ececec" strokeWidth="0.75" />
            <circle cx={EYE_R} cy={EYE_Y} r="9" fill="#fff" stroke="#ececec" strokeWidth="0.75" />

            {handsCover ? (
              <>
                <path
                  d={`M ${EYE_L - 8} ${EYE_Y + 2} Q ${EYE_L} ${EYE_Y + 6} ${EYE_L + 8} ${EYE_Y + 2}`}
                  stroke="#c4c4c4"
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                />
                <path
                  d={`M ${EYE_R - 8} ${EYE_Y + 2} Q ${EYE_R} ${EYE_Y + 6} ${EYE_R + 8} ${EYE_Y + 2}`}
                  stroke="#c4c4c4"
                  strokeWidth="1.75"
                  fill="none"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <>
                <motion.g
                  animate={{ x: pupilX, y: pupilY }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                >
                  <circle cx={EYE_L} cy={EYE_Y} r="3.5" fill="#3d3d3d" />
                  <circle cx={EYE_L - 1.2} cy={EYE_Y - 1.2} r="1" fill="#fff" opacity="0.85" />
                </motion.g>
                <motion.g
                  animate={{ x: pupilX, y: pupilY }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                >
                  <circle cx={EYE_R} cy={EYE_Y} r="3.5" fill="#3d3d3d" />
                  <circle cx={EYE_R - 1.2} cy={EYE_Y - 1.2} r="1" fill="#fff" opacity="0.85" />
                </motion.g>
              </>
            )}

            {/* Smile */}
            <motion.path
              stroke={BRAND_RED}
              strokeWidth="1.75"
              fill="none"
              strokeLinecap="round"
              opacity="0.7"
              animate={{
                d: handsCover
                  ? 'M 52 74 Q 60 70 68 74'
                  : 'M 53 73 Q 60 78 67 73',
              }}
              transition={{ duration: 0.2 }}
            />

            {/* Hands — mirrored pairs */}
            <motion.g
              animate={{
                x: handsCover ? 28 : 16,
                y: handsCover ? handCover.y : handRest.y,
                rotate: handsCover ? -10 : -24,
              }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            >
              <ellipse
                cx="0"
                cy="0"
                rx={handsCover ? handCover.size : handRest.size}
                ry={handsCover ? handCover.size * 0.78 : handRest.size * 0.78}
                fill={BRAND_RED}
                opacity="0.18"
              />
            </motion.g>
            <motion.g
              animate={{
                x: handsCover ? 92 : 104,
                y: handsCover ? handCover.y : handRest.y,
                rotate: handsCover ? 10 : 24,
              }}
              transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            >
              <ellipse
                cx="0"
                cy="0"
                rx={handsCover ? handCover.size : handRest.size}
                ry={handsCover ? handCover.size * 0.78 : handRest.size * 0.78}
                fill={BRAND_RED}
                opacity="0.18"
              />
            </motion.g>
          </svg>
        </div>
      </motion.div>
    </div>
  );
}
