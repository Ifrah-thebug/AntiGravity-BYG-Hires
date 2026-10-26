import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ClipboardCheck, Flame, Plus, X } from 'lucide-react-native';
import { FieldLabel, SelectField } from '@/shared/components/ui';
import { useScrollToFocusedInput } from '@/shared/components/ui/Screen';
import { colors, fonts, radius } from '@/shared/theme';
import { resolveBestSkill } from '@/shared/lib/talentSkillsDisplay';
import { scoreBadgeColors } from '@/shared/lib/skillAssessmentDisplay';

/** Skills list + editable "best skill" (AI-suggested, candidate can change). */
export default function ProfileSkillsEditor({
  skills = [],
  bestSkill = '',
  onSkillsChange,
  onBestSkillChange,
  newSkill = '',
  onNewSkillChange,
  onAddSkill,
  skillScores = {},
  inProgressSkill = '',
  disabled = false,
  maxSkills = 8,
  showAssessmentLink = false,
  onOpenAssessment,
}) {
  const isInProgressSkill = (skill) =>
    inProgressSkill && String(skill).trim().toLowerCase() === String(inProgressSkill).trim().toLowerCase();
  const resolvedBest = resolveBestSkill(bestSkill, skills);
  const scrollToFocused = useScrollToFocusedInput();

  const handleRemove = (skill) => {
    if (disabled) return;
    const next = skills.filter((s) => s !== skill);
    onSkillsChange?.(next);
    if (resolvedBest === skill) {
      onBestSkillChange?.(next[0] || '');
    } else {
      onBestSkillChange?.(resolveBestSkill(bestSkill, next));
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <FieldLabel>Top skill — shown on directory</FieldLabel>
        <Text style={styles.help}>Picked from your CV by AI. Tap the flame on any skill below to change it.</Text>
        {skills.length > 0 ? (
          <SelectField
            value={resolvedBest}
            disabled={disabled}
            highlight
            onChange={(value) => onBestSkillChange?.(value)}
            options={skills.map((skill) => ({
              value: skill,
              label: skillScores[skill] != null ? `${skill} — ${skillScores[skill]}/100` : skill,
            }))}
          />
        ) : (
          <Text style={styles.help}>Add skills below first.</Text>
        )}
      </View>

      <View style={styles.block}>
        <FieldLabel>{`All skills (${skills.length}/${maxSkills})`}</FieldLabel>
        <View style={styles.chips}>
          {skills.map((skill) => {
            const isBest = skill === resolvedBest;
            const assessedScore = skillScores[skill];
            const inProgress = isInProgressSkill(skill);
            const bg = inProgress ? colors.amber100 : isBest ? colors.red : colors.black;
            const fg = inProgress ? colors.amber900 : colors.white;
            return (
              <View key={skill} style={[styles.chip, { backgroundColor: bg }, inProgress && styles.chipProgress]}>
                <Pressable
                  onPress={() => !disabled && onBestSkillChange?.(skill)}
                  hitSlop={6}
                  accessibilityLabel={isBest ? 'Top skill' : 'Set as top skill'}
                >
                  <Flame size={12} color={isBest ? colors.white : 'rgba(255,255,255,0.5)'} fill={isBest ? colors.white : 'transparent'} />
                </Pressable>
                <Text style={[styles.chipText, { color: fg }]}>{skill}</Text>
                {inProgress ? <Text style={styles.progressTag}>In progress</Text> : null}
                {assessedScore != null ? (
                  <Text style={[styles.scoreTag, scoreBadgeColors(assessedScore)]}>{assessedScore}</Text>
                ) : null}
                {!disabled ? (
                  <Pressable onPress={() => handleRemove(skill)} hitSlop={8} accessibilityLabel={`Remove ${skill}`}>
                    <X size={11} color={fg} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        {!disabled ? (
          <View style={styles.addRow}>
            <TextInput
              value={newSkill}
              onChangeText={onNewSkillChange}
              onSubmitEditing={onAddSkill}
              onFocus={scrollToFocused}
              placeholder="Add a skill…"
              placeholderTextColor={colors.gray400}
              returnKeyType="done"
              style={styles.addInput}
            />
            <Pressable
              onPress={onAddSkill}
              disabled={!newSkill?.trim() || skills.length >= maxSkills}
              style={[styles.addBtn, (!newSkill?.trim() || skills.length >= maxSkills) && { opacity: 0.4 }]}
            >
              <Plus size={12} color={colors.white} />
              <Text style={styles.addText}>Add</Text>
            </Pressable>
          </View>
        ) : null}

        {showAssessmentLink ? (
          <Pressable onPress={onOpenAssessment} style={styles.link}>
            <ClipboardCheck size={12} color={colors.red} />
            <Text style={styles.linkText}>Take skills test</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  block: { gap: 8 },
  help: { ...fonts.medium, fontSize: 10, color: colors.gray400 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: 36 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  chipProgress: { borderWidth: 2, borderColor: colors.amber300 },
  chipText: { ...fonts.black, fontSize: 10, textTransform: 'uppercase' },
  progressTag: {
    ...fonts.black,
    fontSize: 8,
    color: colors.amber900,
    backgroundColor: 'rgba(253,230,138,0.8)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  scoreTag: {
    ...fonts.black,
    fontSize: 8,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1,
    ...fonts.bold,
    fontSize: 12,
    color: colors.gray800,
    backgroundColor: colors.gray50,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.black,
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  addText: { ...fonts.black, fontSize: 12, color: colors.white },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  linkText: { ...fonts.black, fontSize: 10, color: colors.red, letterSpacing: 1.5, textTransform: 'uppercase' },
});
