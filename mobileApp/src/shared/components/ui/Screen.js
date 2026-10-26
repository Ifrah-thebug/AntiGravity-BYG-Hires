import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Dimensions, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/shared/theme';

/** Gap kept between the focused field and the top of the keyboard. */
const KEYBOARD_GAP = 24;

const KeyboardScrollContext = createContext({ scrollToFocused: () => {} });

/**
 * Inputs call this on focus so the screen scrolls them above the keyboard
 * (also when moving between fields while the keyboard is already open).
 */
export function useScrollToFocusedInput() {
  return useContext(KeyboardScrollContext).scrollToFocused;
}

/**
 * Standard page wrapper: safe area + keyboard avoiding + scroll.
 * The app runs edge-to-edge on Android, so the OS no longer resizes the window
 * for the keyboard — we pad for it and scroll the focused field into view ourselves.
 * Pass `scroll={false}` for screens that manage their own scrolling.
 */
const Screen = forwardRef(function Screen(
  {
    children,
    scroll = true,
    background = colors.white,
    contentStyle,
    edges = ['top', 'bottom'],
    refreshControl,
    keyboardShouldPersistTaps = 'handled',
    onScroll,
  },
  ref
) {
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef(null);

  useImperativeHandle(ref, () => scrollRef.current, []);

  const scrollToFocused = useCallback(() => {
    // Wait for the keyboard / layout to settle before measuring.
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const scrollView = scrollRef.current;
      if (!input || !scrollView || keyboardTop.current == null) return;
      input.measure((x, y, width, height, pageX, pageY) => {
        const fieldBottom = pageY + height;
        const overlap = fieldBottom + KEYBOARD_GAP - keyboardTop.current;
        if (overlap > 0) {
          scrollView.scrollTo({ y: scrollY.current + overlap, animated: true });
        }
      });
    }, Platform.OS === 'android' ? 120 : 60);
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      keyboardTop.current = e.endCoordinates?.screenY ?? Dimensions.get('screen').height - (e.endCoordinates?.height || 0);
      scrollToFocused();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardTop.current = null;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [scrollToFocused]);

  const handleScroll = useCallback(
    (e) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      onScroll?.(e);
    },
    [onScroll]
  );

  const contextValue = useMemo(() => ({ scrollToFocused }), [scrollToFocused]);

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode="interactive"
      refreshControl={refreshControl}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardScrollContext.Provider value={contextValue}>
      <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={edges}>
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {body}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </KeyboardScrollContext.Provider>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 48 },
});

export default Screen;
