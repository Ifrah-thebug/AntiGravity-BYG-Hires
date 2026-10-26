import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Clock, Layers, RefreshCw, User, XCircle } from 'lucide-react-native';
import { Banner, Button, Card, Chip, InlineLoader, SectionHeader } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { isNetworkError } from '@/core/api/http';
import {
  approvePortfolioRequest,
  declinePortfolioRequest,
  fetchTalentPortfolioRequests,
} from '@/features/portfolio/api/portfolioAccessApi';

function formatClient(row) {
  const name = String(row.client_name || '').trim();
  const company = String(row.company || '').trim();
  if (name && company) return `${name} · ${company}`;
  if (name) return name;
  if (company) return company;
  return row.client_email || 'Client';
}

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function friendlyError(err) {
  if (isNetworkError(err)) {
    return 'Connection issue talking to the server. Your last action may still have saved — tap Refresh.';
  }
  return String(err?.message || err || '') || 'Something went wrong.';
}

/** Clients asking to see the portfolio — talent approves each one (web TalentPortfolioRequestsPanel). */
export default function PortfolioRequestsPanel({ onPendingChange }) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const hasLoadedOnce = useRef(false);

  const applyRows = useCallback(
    (rows, pendingOverride) => {
      const list = Array.isArray(rows) ? rows : [];
      const pending = pendingOverride ?? list.filter((r) => r.status === 'pending').length;
      setRequests(list);
      setPendingCount(pending);
      onPendingChange?.(pending);
    },
    [onPendingChange]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setLoading(true);
        setError('');
      }
      try {
        const data = await fetchTalentPortfolioRequests();
        applyRows(data.requests || [], data.pendingCount);
        hasLoadedOnce.current = true;
        if (silent) setError('');
      } catch (err) {
        // Keep existing rows on transient errors so approve success isn't wiped to empty.
        if (!hasLoadedOnce.current || !silent) setError(friendlyError(err));
        if (!hasLoadedOnce.current) applyRows([], 0);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applyRows]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleDecision(requestId, decision) {
    setActingId(requestId);
    setError('');
    setMessage('');

    const previous = requests;
    const nextStatus = decision === 'approve' ? 'approved' : 'declined';
    const now = new Date().toISOString();

    // Optimistic update — don't wait for reload to show the result.
    applyRows(previous.map((row) => (row.id === requestId ? { ...row, status: nextStatus, responded_at: now } : row)));

    try {
      if (decision === 'approve') {
        await approvePortfolioRequest(requestId);
        setMessage('Portfolio access approved for this client.');
      } else {
        await declinePortfolioRequest(requestId);
        setMessage('Request declined.');
      }
      await load({ silent: true });
    } catch (err) {
      applyRows(previous);
      setMessage('');
      setError(friendlyError(err));
    } finally {
      setActingId('');
    }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const handled = requests.filter((r) => r.status !== 'pending');

  return (
    <Card>
      <SectionHeader
        eyebrow={pendingCount > 0 ? `Client requests · ${pendingCount}` : 'Client requests'}
        eyebrowIcon={Layers}
        title="Portfolio access requests"
        description="Clients request to see your portfolio before you share it. Approve each client individually — you stay in control."
      />
      <Button
        title="Refresh"
        size="sm"
        variant="outline"
        icon={RefreshCw}
        fullWidth={false}
        disabled={loading}
        onPress={() => {
          setMessage('');
          load();
        }}
      />

      {error && !message ? (
        <Banner tone="error" message={error}>
          <Text style={styles.retry} onPress={() => { setError(''); load(); }}>Retry</Text>
        </Banner>
      ) : null}
      {message ? <Banner tone="success" message={message} /> : null}

      {loading && !hasLoadedOnce.current ? (
        <InlineLoader />
      ) : pending.length === 0 && handled.length === 0 ? (
        <View style={styles.empty}>
          <Layers size={24} color={colors.gray300} />
          <Text style={styles.emptyTitle}>No portfolio requests yet</Text>
          <Text style={styles.emptyText}>When a client asks to see your portfolio, it will show up here and in BGuides.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {pending.map((row) => (
            <View key={row.id} style={styles.pendingCard}>
              <View style={styles.row}>
                <View style={styles.avatar}>
                  <User size={16} color={colors.white} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.client}>{formatClient(row)}</Text>
                  <Text style={styles.when}>Requested {formatWhen(row.requested_at)}</Text>
                </View>
                <Chip label="Pending" tone="amber" />
              </View>
              <View style={styles.actions}>
                <Button
                  title="Approve"
                  size="sm"
                  variant="danger"
                  icon={CheckCircle2}
                  loading={actingId === row.id}
                  disabled={actingId === row.id}
                  onPress={() => handleDecision(row.id, 'approve')}
                  style={styles.flex}
                />
                <Button
                  title="Decline"
                  size="sm"
                  variant="outline"
                  icon={XCircle}
                  disabled={actingId === row.id}
                  onPress={() => handleDecision(row.id, 'decline')}
                  style={styles.flex}
                />
              </View>
            </View>
          ))}

          {handled.length > 0 ? (
            <View style={styles.recent}>
              <Text style={[type.eyebrow, { color: colors.gray400 }]}>Recent</Text>
              {handled.slice(0, 8).map((row) => (
                <View key={row.id} style={styles.handled}>
                  <View style={styles.flex}>
                    <Text style={styles.handledName} numberOfLines={1}>{formatClient(row)}</Text>
                    <Text style={styles.when}>{formatWhen(row.responded_at || row.requested_at)}</Text>
                  </View>
                  {row.status === 'approved' ? (
                    <Chip label="Approved" tone="green" icon={CheckCircle2} />
                  ) : (
                    <Chip label="Declined" tone="gray" icon={Clock} />
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  retry: { ...fonts.bold, fontSize: 12, color: colors.red, textDecorationLine: 'underline', marginTop: 4 },
  empty: {
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    padding: 22,
    gap: 4,
  },
  emptyTitle: { ...fonts.bold, fontSize: 14, color: colors.gray500, marginTop: 6 },
  emptyText: { ...fonts.medium, fontSize: 12, color: colors.gray400, textAlign: 'center' },
  list: { gap: 12 },
  pendingCard: {
    borderWidth: 1,
    borderColor: colors.amber200,
    backgroundColor: 'rgba(255,251,235,0.5)',
    borderRadius: radius.lg,
    padding: 14,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  client: { ...fonts.black, fontSize: 14, color: colors.gray900 },
  when: { ...fonts.medium, fontSize: 11, color: colors.gray500, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  recent: { gap: 8, paddingTop: 4 },
  handled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  handledName: { ...fonts.bold, fontSize: 14, color: colors.gray800 },
});
