import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { BottomSheet, Button } from '@/shared/components/ui';
import { colors, fonts, type } from '@/shared/theme';

const SECTIONS = [
  ['1. Purpose', ["The purpose of this Agreement is to govern the Candidate's participation in the BYG Hires Talent Pool and the use, processing, and sharing of the Candidate's information for recruitment and staffing opportunities."]],
  ['2. Talent Pool Registration', [
    '2.1 The Candidate agrees to join the BYG Hires Talent Pool for consideration in remote employment, freelance, contractual, or recruitment opportunities.',
    '2.2 Registration does not create an employment relationship between BYG Hires and the Candidate.',
    '2.3 BYG Hires does not guarantee placement, interviews, employment offers, or minimum opportunities.',
  ]],
  ['3. Collection of Information', [
    '3.1 The Candidate authorizes BYG Hires to collect, process, store, and maintain personal and professional information, including but not limited to: full name and contact information, Resume/CV, employment history, educational qualifications, portfolio or work samples, interview feedback and assessments, and identification or verification documents where required.',
    '3.2 The Candidate confirms that all submitted information is accurate, complete, and lawful.',
  ]],
  ['4. Use of Information', [
    "4.1 BYG Hires may use the Candidate's information for: recruitment and staffing purposes; candidate evaluation and verification; matching Candidates with potential employers or clients; scheduling interviews and communications; future employment opportunities and database management.",
    '4.2 The Candidate authorizes BYG Hires to share relevant information with prospective employers or clients strictly for hiring-related purposes.',
  ]],
  ['5. Data Privacy & Protection', [
    '5.1 BYG Hires shall implement commercially reasonable measures to protect Candidate information against unauthorized access, disclosure, misuse, or loss.',
    '5.2 BYG Hires shall process Candidate data in accordance with applicable GCC data protection principles, including the UAE Personal Data Protection Law (PDPL), where applicable.',
    "5.3 BYG Hires shall not sell Candidate's personal information to unrelated third parties.",
  ]],
  ['6. Candidate Obligations', ['The Candidate agrees that: all information provided is truthful and up to date; submitted materials do not violate confidentiality obligations owed to third parties; the Candidate shall conduct themselves professionally during recruitment processes; and the Candidate shall not misuse confidential information received during interviews or assessments.']],
  ['7. Confidentiality', [
    '7.1 Any documents, assessments, interview materials, employer information, platform systems, or recruitment processes shared by BYG Hires shall remain confidential.',
    '7.2 The Candidate shall not reproduce, distribute, disclose, or misuse confidential information without prior written consent.',
  ]],
  ['8. Intellectual Property', ['All website content, branding, systems, databases, templates, recruitment materials, and platform intellectual property remain the exclusive property of BYG Hires unless otherwise stated.']],
  ['9. No Employment Relationship', [
    '9.1 BYG Hires acts solely as a staffing and recruitment intermediary.',
    '9.2 Nothing in this Agreement shall be interpreted as creating an employer-employee relationship, partnership, or agency relationship between BYG Hires and the Candidate.',
  ]],
  ['10. Limitation of Liability', [
    '10.1 BYG Hires shall not be liable for: hiring decisions made by clients; rejection of applications; employment termination by clients; candidate compensation disputes; or indirect, consequential, or business losses arising from platform use.',
    '10.2 Candidates engage with prospective employers at their own discretion and responsibility.',
  ]],
  ['11. Termination & Withdrawal', [
    '11.1 The Candidate may request removal from the Talent Pool at any time by written request.',
    '11.2 BYG Hires reserves the right to suspend, restrict, or terminate Candidate access for: fraudulent activity, misrepresentation, unprofessional conduct, violation of this Agreement, or unlawful activities.',
  ]],
  ['12. Governing Law & Jurisdiction', [
    '12.1 This Agreement shall be governed by and construed in accordance with the laws of the United Arab Emirates.',
    '12.2 The Parties shall first attempt to resolve disputes through good faith negotiations.',
    '12.3 Any unresolved dispute shall be subject to arbitration under the rules of the Dubai International Arbitration Centre (DIAC), with the seat of arbitration in Dubai, UAE.',
  ]],
  ['13. Acceptance', ['By selecting the acceptance checkbox on the BYG Hires platform, the Candidate confirms that they have read, understood, and agreed to the terms of this Agreement.']],
];

/** Candidate Talent Pool Agreement — same text as the web signup modal. */
export default function AgreementModal({ visible, onClose, onAccept }) {
  const header = (
    <View style={styles.header}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.flex}>
        <Text style={[type.eyebrow, { color: colors.red, fontSize: 9 }]}>Legal Agreement</Text>
        <Text style={styles.title}>Candidate Talent Pool Agreement</Text>
      </View>
      <Pressable onPress={onClose} style={styles.close} hitSlop={10}>
        <X size={14} color={colors.white} />
      </Pressable>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      header={header}
      scroll
      footer={
        <View style={styles.footerRow}>
          <Button title="Accept Terms" size="sm" onPress={onAccept} style={styles.flex} />
          <Button title="Close" size="sm" variant="outline" onPress={onClose} style={styles.flex} />
        </View>
      }
    >
      <View style={styles.body}>
        {SECTIONS.map(([heading, paragraphs]) => (
          <View key={heading} style={styles.section}>
            <Text style={styles.heading}>{heading}</Text>
            {paragraphs.map((p) => (
              <Text key={p} style={styles.para}>{p}</Text>
            ))}
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    backgroundColor: colors.black,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.red,
    opacity: 0.25,
  },
  title: { ...fonts.black, fontSize: 17, color: colors.white, textTransform: 'uppercase', marginTop: 4 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: 18, paddingBottom: 8 },
  section: { gap: 6 },
  heading: { ...fonts.black, fontSize: 12, color: colors.black, textTransform: 'uppercase', letterSpacing: 1 },
  para: { ...fonts.medium, fontSize: 13, lineHeight: 20, color: colors.gray600 },
  footerRow: { flexDirection: 'row', gap: 10 },
});
