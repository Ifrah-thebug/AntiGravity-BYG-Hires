import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, DollarSign, ExternalLink, MessageCircle, Send, Sparkles, X } from 'lucide-react-native';
import { colors, fonts, radius, type } from '@/shared/theme';
import { env } from '@/core/config/env';
import { isNetworkError } from '@/core/api/http';
import { useAuth } from '@/features/auth/context/AuthContext';
import { TALENT_ROUTES } from '@/app/navigation/routes';
import { getCurrentRoute, navigationRef } from '@/app/navigation/navigationRef';
import { QUICK_PROMPTS, fetchTalentChatSession, sendTalentChatMessage } from '@/features/chat/api/talentChatApi';
import { routeForWebHref, webPathForRoute } from '@/features/chat/utils/webPathMapping';

function PricingTipCard({ tip }) {
  if (!tip?.suggestedMonthlyUsd) return null;
  return (
    <View style={styles.tip}>
      <View style={styles.rowGap}>
        <DollarSign size={10} color={colors.red} />
        <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>Suggested pricing</Text>
      </View>
      <View style={styles.tipRow}>
        <View>
          <Text style={styles.tipLabel}>Monthly</Text>
          <Text style={styles.tipValue}>${tip.suggestedMonthlyUsd}</Text>
        </View>
        <View>
          <Text style={styles.tipLabel}>Client sees</Text>
          <Text style={[styles.tipValue, { color: colors.red, fontSize: 17 }]}>${tip.suggestedDirectoryUsd}</Text>
        </View>
      </View>
      {tip.rationale ? <Text style={styles.tipText}>{tip.rationale}</Text> : null}
    </View>
  );
}

function ChatMessage({ message, onAction }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.msgRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        {!isUser ? (
          <View style={[styles.rowGap, { marginBottom: 6 }]}>
            <Sparkles size={9} color={colors.red} />
            <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>BGuides</Text>
          </View>
        ) : null}
        <Text style={[styles.msgText, isUser && { color: colors.white }]}>{message.content}</Text>
        {!isUser ? <PricingTipCard tip={message.pricingTip} /> : null}
        {!isUser && message.actions?.length ? (
          <View style={styles.actions}>
            {message.actions.map((action) => (
              <Pressable
                key={action.id}
                onPress={() => onAction(action)}
                style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.black }]}
              >
                <Text style={styles.actionText}>{action.label}</Text>
                {action.external ? <ExternalLink size={12} color={colors.white} /> : <ArrowRight size={12} color={colors.white} />}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** BGuides — floating onboarding assistant for signed-in talent (web TalentOnboardingChat). */
export default function TalentChatLauncher({ routeName }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState(null);
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const sendingRef = useRef(false);

  const visible = Boolean(user?.id) && TALENT_ROUTES.has(routeName);
  const currentPath = () => webPathForRoute(getCurrentRoute());

  // A different account must never see the previous user's chat history or badge.
  useEffect(() => {
    setMessages([]);
    setContext(null);
    setInput('');
    setError('');
    setOpen(false);
  }, [user?.id]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchTalentChatSession(webPathForRoute(getCurrentRoute()));
      setMessages(data.messages || []);
      setContext(data.context || null);
    } catch (err) {
      setError(err.message || 'Could not load chat.');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [scrollToBottom]);

  // Badge count (pending portfolio requests etc.) when the user lands on a talent screen.
  useEffect(() => {
    if (!visible || open || sendingRef.current) return;
    fetchTalentChatSession(webPathForRoute(getCurrentRoute()))
      .then((data) => setContext(data.context || null))
      .catch(() => {});
  }, [visible, open, routeName]);

  useEffect(() => {
    if (visible && open && !sendingRef.current) loadSession();
  }, [visible, open, loadSession]);

  const handleSend = async (text) => {
    const msg = String(text ?? input).trim();
    if (!msg || sending) return;

    setInput('');
    sendingRef.current = true;
    setSending(true);
    setError('');

    const optimistic = { id: `tmp-${Date.now()}`, role: 'user', content: msg, actions: [], pricingTip: null };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    try {
      const data = await sendTalentChatMessage(msg, currentPath());
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        { ...optimistic, id: `user-${Date.now()}` },
        data.message,
      ]);
      setContext(data.context || null);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? 'Connection lost while BGuides was thinking. Checking if your message was saved…'
          : err.message || 'Could not send message.'
      );
      try {
        const data = await fetchTalentChatSession(currentPath());
        setMessages(data.messages || []);
        setContext(data.context || null);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
      scrollToBottom();
    }
  };

  const handleAction = (action) => {
    if (!action?.href) return;
    const href = String(action.href).trim();
    if (action.external || /^[a-z][a-z0-9+.-]*:/i.test(href)) {
      // Links come from the server / AI: only open real web pages (no intent:, tel:, market:…).
      if (/^https?:\/\//i.test(href)) Linking.openURL(href).catch(() => {});
      return;
    }
    const target = routeForWebHref(href);
    if (target && navigationRef.isReady()) {
      // pop: go back to the screen if it is already in the stack instead of stacking a copy.
      navigationRef.navigate(target.name, target.params, { pop: true });
      setOpen(false);
      return;
    }
    if (env.webAppUrl) Linking.openURL(`${env.webAppUrl}${href.startsWith('/') ? '' : '/'}${href}`).catch(() => {});
  };

  if (!visible) return null;

  const notifications = Number(context?.guideNotificationCount) || 0;
  const subtitle =
    context?.guideNotificationLabel ||
    (context?.pendingPortfolioRequestCount > 0
      ? `${context.pendingPortfolioRequestCount} portfolio request${context.pendingPortfolioRequestCount > 1 ? 's' : ''} waiting`
      : context?.directoryStatus === 'approved'
        ? "Profile live — let's get you more intros"
        : 'Finish your profile faster');

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.fab,
          { bottom: Math.max(insets.bottom, 12) + 8 },
          pressed && { backgroundColor: colors.black },
        ]}
        accessibilityLabel="Open BGuides"
      >
        <MessageCircle size={16} color={colors.white} />
        <Text style={styles.fabText}>BGuides</Text>
        {notifications > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{notifications > 9 ? '9+' : notifications}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView style={styles.modalRoot} behavior="padding">
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <View style={styles.header}>
              <View pointerEvents="none" style={styles.glow} />
              <View style={styles.flex}>
                <View style={styles.rowGap}>
                  <Sparkles size={10} color={colors.red} />
                  <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>Onboarding assistant</Text>
                </View>
                <Text style={styles.headerTitle}>BGuides</Text>
                <Text style={styles.headerSub}>{subtitle}</Text>
              </View>
              <Pressable onPress={() => setOpen(false)} style={styles.close} hitSlop={10} accessibilityLabel="Close chat">
                <X size={15} color={colors.white} />
              </Pressable>
            </View>

            {loading && messages.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.gray300} />
              </View>
            ) : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(m) => String(m.id)}
                renderItem={({ item }) => <ChatMessage message={item} onAction={handleAction} />}
                contentContainerStyle={styles.list}
                onContentSizeChange={scrollToBottom}
                ListFooterComponent={
                  sending ? (
                    <View style={[styles.msgRow, { justifyContent: 'flex-start' }]}>
                      <View style={[styles.bubble, styles.bubbleBot, styles.rowGap]}>
                        <ActivityIndicator size="small" color={colors.gray400} />
                        <Text style={styles.thinking}>Thinking…</Text>
                      </View>
                    </View>
                  ) : null
                }
              />
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!loading && messages.length <= 2 ? (
              <View style={styles.prompts}>
                {QUICK_PROMPTS.map((prompt) => (
                  <Pressable key={prompt} onPress={() => handleSend(prompt)} disabled={sending} style={styles.prompt}>
                    <Text style={styles.promptText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your profile…"
                placeholderTextColor={colors.gray400}
                editable={!sending}
                onSubmitEditing={() => handleSend()}
                returnKeyType="send"
                style={styles.input}
              />
              <Pressable
                onPress={() => handleSend()}
                disabled={sending || !input.trim()}
                style={[styles.send, (sending || !input.trim()) && { opacity: 0.4 }]}
                accessibilityLabel="Send message"
              >
                {sending ? <ActivityIndicator size="small" color={colors.white} /> : <Send size={16} color={colors.white} />}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.red,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabText: { ...fonts.black, fontSize: 10, color: colors.white, textTransform: 'uppercase', letterSpacing: 1.5 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...fonts.black, fontSize: 9, color: colors.red },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: {
    height: '82%',
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  header: { backgroundColor: colors.black, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', gap: 12, overflow: 'hidden' },
  glow: { position: 'absolute', top: -40, right: -40, width: 128, height: 128, borderRadius: 64, backgroundColor: colors.red, opacity: 0.25 },
  headerTitle: { ...fonts.black, fontSize: 16, color: colors.white, marginTop: 2 },
  headerSub: { ...fonts.medium, fontSize: 11, color: colors.gray400, marginTop: 4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12, backgroundColor: '#fafafa', flexGrow: 1 },
  msgRow: { flexDirection: 'row' },
  bubble: { maxWidth: '92%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11 },
  bubbleUser: { backgroundColor: colors.black, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderBottomLeftRadius: 4 },
  msgText: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray700 },
  thinking: { ...fonts.bold, fontSize: 12, color: colors.gray400 },
  tip: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.black, gap: 8 },
  tipRow: { flexDirection: 'row', gap: 20, alignItems: 'flex-end' },
  tipLabel: { ...fonts.bold, fontSize: 10, color: colors.gray400, textTransform: 'uppercase' },
  tipValue: { ...fonts.black, fontSize: 20, color: colors.white },
  tipText: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray300 },
  actions: { marginTop: 10, gap: 8 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionText: { ...fonts.black, fontSize: 10, color: colors.white, textTransform: 'uppercase', letterSpacing: 1.2, flex: 1 },
  error: {
    ...fonts.semibold,
    fontSize: 11,
    color: colors.red,
    backgroundColor: colors.red5,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  prompts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  prompt: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray200, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  promptText: { ...fonts.bold, fontSize: 10, color: colors.gray600 },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.gray100 },
  input: {
    flex: 1,
    ...fonts.medium,
    fontSize: 14,
    color: colors.gray900,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  send: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
});
