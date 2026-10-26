import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateField, SelectField, TextField } from '@/shared/components/ui';
import { colors, fonts } from '@/shared/theme';
import { TALENT_DEPARTMENTS } from '@/shared/lib/talentDepartments';
import { normalizeProfileName } from '@/shared/lib/formatDisplayName';
import { AVAILABILITY_OPTIONS, ROLE_TYPE_OPTIONS } from '@/features/profile/utils/profileContentPolicy';

const DEPARTMENT_OPTIONS = TALENT_DEPARTMENTS.map((d) => ({ value: d.id, label: d.label }));

/**
 * Name, title, department, about, experience, fee, availability and timing —
 * the shared field set of web TalentSetupPage + PortalPage.
 */
export default function ProfileFields({ form, setForm, disabled = false, departmentHint, onLayoutPricing }) {
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <View style={styles.wrap}>
      <TextField
        label="Full Name"
        required
        value={form.name}
        onChangeText={set('name')}
        onBlur={() => setForm((f) => ({ ...f, name: normalizeProfileName(f.name) }))}
        editable={!disabled}
        autoCapitalize="words"
      />

      <TextField
        label="Professional Title"
        required
        value={form.job_title}
        onChangeText={set('job_title')}
        editable={!disabled}
      />

      <SelectField
        label="Department"
        value={form.department}
        options={DEPARTMENT_OPTIONS}
        onChange={set('department')}
        disabled={disabled}
        hint={departmentHint}
      />

      <TextField
        label="About"
        value={form.about}
        onChangeText={set('about')}
        placeholder="Professional summary only — no contact details."
        multiline
        numberOfLines={4}
        editable={!disabled}
        inputStyle={styles.about}
      />

      <TextField
        label="Years of Experience"
        value={String(form.experience_years ?? '')}
        onChangeText={(v) => set('experience_years')(v.replace(/[^0-9]/g, '').slice(0, 2))}
        keyboardType="number-pad"
        editable={!disabled}
        inputStyle={styles.narrow}
      />

      <View onLayout={onLayoutPricing} style={styles.wrap}>
        <View style={styles.feeBlock}>
          <TextField
            label="Monthly Fee (USD)"
            value={String(form.monthly_fee_usd ?? '')}
            onChangeText={(v) => set('monthly_fee_usd')(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            editable={!disabled}
          />
          <Text style={styles.feeHint}>BYG Hires will add a 10% markup as platform fees.</Text>
        </View>

        <SelectField
          label="Availability"
          value={form.availability}
          options={AVAILABILITY_OPTIONS}
          onChange={set('availability')}
          disabled={disabled}
        />

        {form.availability === 'from_month' ? (
          <DateField
            label="Available From (Date)"
            value={String(form.availability_from_month || '').slice(0, 10)}
            onChange={set('availability_from_month')}
            disabled={disabled}
          />
        ) : null}
      </View>

      <SelectField
        label="Timing Preference"
        value={form.role_type}
        options={ROLE_TYPE_OPTIONS}
        onChange={set('role_type')}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  about: { ...fonts.medium, color: colors.gray700, lineHeight: 21 },
  narrow: { maxWidth: 128 },
  feeBlock: { gap: 6 },
  feeHint: { ...fonts.semibold, fontSize: 10, color: colors.gray400 },
});
