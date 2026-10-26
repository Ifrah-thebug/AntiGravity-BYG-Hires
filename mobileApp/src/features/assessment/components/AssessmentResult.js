import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { Button, ScoreBadge } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { scoreBadgeColors } from '@/shared/lib/skillAssessmentDisplay';

const DIMENSION_LABELS = {
  relevance: 'Relevance',
  depth: 'Depth',
  clarity: 'Clarity',
  practicality: 'Practicality',
  problem_solving: 'Problem solving',
};

function formatSubmittedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Score + dimension breakdown + per-question feedback. */
export default function AssessmentResult({ result, session, viewingPast, starting, onRetake, onTestAnother, onBackToPortal }) {
  const breakdown = result.session?.score_breakdown || {};
  const perQuestion = breakdown.per_question || [];
  const dimensions = breakdown.dimensions || {};
  const questionsById = Object.fromEntries((session?.questions || []).map((q) => [q.id, q]));

  return (
    <View style={styles.wrap}>
      <View style={styles.center}>
        <View style={styles.checkCircle}>
          <CheckCircle2 size={36} color={colors.green600} />
        </View>
        <Text style={styles.title}>{viewingPast ? 'Your skills test results' : 'Skills test complete'}</Text>
        <Text style={styles.skill}>{session?.skill}</Text>
        {viewingPast && session?.submitted_at ? (
          <Text style={styles.submitted}>Submitted {formatSubmittedAt(session.submitted_at)}</Text>
        ) : null}
      </View>

      <View style={styles.center}>
        <ScoreBadge score={result.total_score} suffix="/100" large />
        <Text style={[type.eyebrow, styles.scoreLabel]}>Your score</Text>
      </View>

      {result.summary ? (
        <View style={styles.box}>
          <Text style={[type.eyebrow, styles.boxLabel]}>Overall feedback</Text>
          <Text style={styles.boxText}>{result.summary}</Text>
        </View>
      ) : null}

      {Object.keys(dimensions).length > 0 ? (
        <View style={styles.section}>
          <Text style={[type.eyebrow, styles.boxLabel]}>How you were scored</Text>
          {Object.entries(dimensions).map(([key, dim]) => (
            <View key={key} style={styles.dim}>
              <View style={styles.dimRow}>
                <Text style={styles.dimName}>{DIMENSION_LABELS[key] || key.replace(/_/g, ' ')}</Text>
                <Text style={styles.dimScore}>{dim.score ?? '—'}/{dim.max ?? '—'}</Text>
              </View>
              {dim.note ? <Text style={styles.dimNote}>{dim.note}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {perQuestion.length > 0 ? (
        <View style={styles.section}>
          <Text style={[type.eyebrow, styles.boxLabel]}>Question-by-question feedback</Text>
          {perQuestion.map((item, index) => {
            const q = questionsById[item.id];
            const max = item.max_points ?? 20;
            const c = scoreBadgeColors(Math.round((item.score / (item.max_points || 20)) * 100));
            return (
              <View key={item.id || index} style={styles.dim}>
                <View style={styles.dimRow}>
                  <Text style={styles.qLabel}>
                    Question {index + 1}
                    {q?.type ? ` · ${q.type}` : ''}
                  </Text>
                  <Text style={[styles.qScore, c]}>{item.score}/{max}</Text>
                </View>
                {q?.prompt ? <Text style={styles.qPrompt} numberOfLines={3}>{q.prompt}</Text> : null}
                {item.feedback ? <Text style={styles.qFeedback}>{item.feedback}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.note}>
        {viewingPast
          ? 'Review your feedback below, then retake when you are ready to improve your score.'
          : 'Use this feedback to improve before your next skills test on this skill.'}
      </Text>

      <View style={styles.actions}>
        {viewingPast ? (
          <Button
            title={starting ? 'Starting…' : 'Retake with new questions'}
            variant="danger"
            iconRight={ArrowRight}
            loading={starting}
            onPress={onRetake}
          />
        ) : null}
        <Button title="Test another skill" onPress={onTestAnother} />
        <Button title="Back to portal" variant="outline" onPress={onBackToPortal} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  center: { alignItems: 'center', gap: 6 },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { ...fonts.extrabold, fontSize: 26, color: colors.black, textAlign: 'center' },
  skill: { ...fonts.medium, fontSize: 14, color: colors.gray500 },
  submitted: { ...fonts.semibold, fontSize: 11, color: colors.gray400 },
  scoreLabel: { color: colors.gray500, marginTop: 4 },
  box: { backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg, padding: 18, gap: 8 },
  boxLabel: { color: colors.gray400 },
  boxText: { ...fonts.medium, fontSize: 14, lineHeight: 21, color: colors.gray700 },
  section: { gap: 10 },
  dim: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg, padding: 14, gap: 6 },
  dimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  dimName: { ...fonts.black, fontSize: 12, color: colors.black, flex: 1 },
  dimScore: { ...fonts.black, fontSize: 14, color: colors.red },
  dimNote: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray500 },
  qLabel: { ...fonts.black, fontSize: 10, color: colors.red, textTransform: 'uppercase', letterSpacing: 1.5, flex: 1 },
  qScore: { ...fonts.black, fontSize: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  qPrompt: { ...fonts.medium, fontSize: 12, lineHeight: 17, color: colors.gray500 },
  qFeedback: {
    ...fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.gray800,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 8,
  },
  note: { ...fonts.medium, fontSize: 11, color: colors.gray400, textAlign: 'center' },
  actions: { gap: 10 },
});
