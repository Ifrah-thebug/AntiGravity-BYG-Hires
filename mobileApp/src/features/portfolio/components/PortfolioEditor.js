import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { Banner, Button, Checkbox, Chip, InlineLoader, TextField } from '@/shared/components/ui';
import { colors, fonts, radius, type } from '@/shared/theme';
import { pickImageFile, uploadPortfolioCover } from '@/core/storage/files';
import { useCopyToClipboard } from '@/shared/hooks/useCopyToClipboard';
import {
  createPortfolioProject,
  deletePortfolioProject,
  fetchOwnPortfolioProjects,
  isValidProjectUrl,
  normalizeProjectUrl,
  reorderPortfolioProjects,
  updatePortfolioProject,
} from '@/features/portfolio/api/portfolioApi';
import { usePortfolioSharing } from '@/features/portfolio/hooks/usePortfolioSharing';

const emptyDraft = () => ({
  title: '',
  description: '',
  project_url: '',
  tagsInput: '',
  published: true,
});

const parseTags = (input) => {
  const seen = new Set();
  return String(input || '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => {
      // "React, react" is one tag (duplicates also broke list keys).
      const key = t.toLowerCase();
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

/**
 * "Project chapters" editor (web PortalPortfolioEditor).
 * `embedded` = Chapter studio inside the storybook screen.
 */
export default function PortfolioEditor({
  profileId,
  userId,
  autoOpenAdd = false,
  openAddSignal = 0,
  onAutoOpenHandled,
  onProjectsChange,
  embedded = false,
  onOpenStorybook,
  onPreview,
  refreshKey = 0,
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [coverFile, setCoverFile] = useState(null);
  const { shareUrl } = usePortfolioSharing(embedded ? null : profileId);
  const { copy, copiedKey } = useCopyToClipboard();

  const loadProjects = useCallback(async ({ silent = false } = {}) => {
    if (!profileId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      setProjects(await fetchOwnPortfolioProjects(profileId));
    } catch (e) {
      setError(e.message || 'Failed to load portfolio.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Host screen regained focus (e.g. back from the storybook): pick up chapter changes.
  useEffect(() => {
    if (refreshKey) loadProjects({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const notifyChange = useCallback(() => onProjectsChange?.(), [onProjectsChange]);

  const openAddForm = useCallback(() => {
    setEditingId(null);
    setDraft(emptyDraft());
    setCoverFile(null);
    setShowForm(true);
    setError('');
  }, []);

  useEffect(() => {
    if (!autoOpenAdd) return;
    openAddForm();
    onAutoOpenHandled?.();
  }, [autoOpenAdd, onAutoOpenHandled, openAddForm]);

  useEffect(() => {
    if (openAddSignal) openAddForm();
  }, [openAddSignal, openAddForm]);

  const resetForm = () => {
    setDraft(emptyDraft());
    setCoverFile(null);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const startEdit = (project) => {
    setEditingId(project.id);
    setDraft({
      title: project.title || '',
      description: project.description || '',
      project_url: project.project_url || '',
      tagsInput: (project.tags || []).join(', '),
      published: project.published !== false,
    });
    setCoverFile(null);
    setShowForm(true);
    setError('');
  };

  const pickCover = async () => {
    try {
      const file = await pickImageFile({ maxEdge: 1800 });
      if (file) setCoverFile(file);
    } catch (e) {
      setError(e.message || 'Could not open your photos.');
    }
  };

  const handleSave = async () => {
    if (!profileId || !userId) return;
    const title = draft.title.trim();
    if (!title) {
      setError('Project title is required.');
      return;
    }
    if (draft.project_url && !isValidProjectUrl(draft.project_url)) {
      setError('Enter a valid project URL (https://…).');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const tags = parseTags(draft.tagsInput);
      const fields = {
        title,
        description: draft.description.trim(),
        project_url: draft.project_url,
        tags,
        published: draft.published,
      };

      if (editingId) {
        let updated = await updatePortfolioProject(editingId, fields);
        if (coverFile) {
          const coverUrl = await uploadPortfolioCover(userId, editingId, coverFile);
          updated = await updatePortfolioProject(editingId, { cover_image_url: coverUrl });
        }
        setProjects((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await createPortfolioProject({
          profileId,
          userId,
          title,
          description: fields.description,
          projectUrl: draft.project_url,
          tags,
          published: draft.published,
        });
        // The chapter exists now: if the cover upload fails, "Save" again must update this
        // chapter instead of creating a duplicate.
        setProjects((prev) => [...prev, created]);
        setEditingId(created.id);
        notifyChange();
        if (coverFile) {
          const coverUrl = await uploadPortfolioCover(userId, created.id, coverFile);
          const withCover = await updatePortfolioProject(created.id, { cover_image_url: coverUrl });
          setProjects((prev) => prev.map((p) => (p.id === created.id ? withCover : p)));
        }
      }

      resetForm();
      notifyChange();
    } catch (err) {
      setError(err.message || `Failed to ${editingId ? 'update' : 'save'} project.`);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (project) => {
    try {
      const updated = await updatePortfolioProject(project.id, { published: !project.published });
      setProjects((prev) => prev.map((p) => (p.id === project.id ? updated : p)));
      notifyChange();
    } catch (e) {
      setError(e.message || 'Failed to update project.');
    }
  };

  const handleDelete = (projectId) => {
    Alert.alert('Delete project', 'Delete this portfolio project?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePortfolioProject(projectId);
            setProjects((prev) => prev.filter((p) => p.id !== projectId));
            notifyChange();
          } catch (e) {
            setError(e.message || 'Failed to delete project.');
          }
        },
      },
    ]);
  };

  const moveProject = async (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= projects.length) return;
    const ordered = [...projects];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    setProjects(ordered);
    try {
      await reorderPortfolioProjects(profileId, ordered.map((p) => p.id));
      notifyChange();
    } catch (e) {
      setError(e.message || 'Failed to reorder.');
      loadProjects();
    }
  };

  if (!profileId) return null;

  const publishedCount = projects.filter((p) => p.published).length;
  const draftCount = projects.length - publishedCount;
  const existingCover = editingId ? projects.find((p) => p.id === editingId)?.cover_image_url : '';

  const formBlock = showForm ? (
    <View style={styles.form}>
      <Text style={[type.eyebrow, { color: colors.gray500 }]}>{editingId ? 'Edit project' : 'New project'}</Text>
      <TextField
        label="Project Title *"
        value={draft.title}
        onChangeText={(title) => setDraft((d) => ({ ...d, title }))}
        placeholder="e.g. E-commerce Redesign"
      />
      <TextField
        label="Description"
        value={draft.description}
        onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
        placeholder="What you built, your role, and the outcome."
        multiline
        numberOfLines={3}
      />
      <TextField
        label="Live Work Link"
        icon={Link2}
        value={draft.project_url}
        onChangeText={(project_url) => setDraft((d) => ({ ...d, project_url }))}
        placeholder="https://github.com/…"
        keyboardType="url"
        autoCapitalize="none"
      />
      <TextField
        label="Tags"
        value={draft.tagsInput}
        onChangeText={(tagsInput) => setDraft((d) => ({ ...d, tagsInput }))}
        placeholder="React, UI Design, SaaS"
      />

      <View style={styles.coverBlock}>
        <View style={styles.rowGap}>
          <ImageIcon size={11} color={colors.gray500} />
          <Text style={[type.label, { color: colors.gray500 }]}>Cover Image</Text>
        </View>
        <Button title={coverFile ? 'Change image' : 'Choose image'} size="sm" fullWidth={false} onPress={pickCover} />
        {coverFile?.uri || existingCover ? (
          <Image source={{ uri: coverFile?.uri || existingCover }} style={styles.coverPreview} resizeMode="cover" />
        ) : null}
      </View>

      <Checkbox checked={draft.published} onChange={(published) => setDraft((d) => ({ ...d, published }))}>
        <Text style={styles.checkLabel}>Publish on portfolio page</Text>
      </Checkbox>

      <View style={styles.formActions}>
        <Button
          title={saving ? 'Saving…' : editingId ? 'Update project' : 'Save project'}
          size="sm"
          loading={saving}
          onPress={handleSave}
          style={styles.flex}
        />
        <Button title="Cancel" size="sm" variant="outline" fullWidth={false} onPress={resetForm} />
      </View>
    </View>
  ) : null;

  const projectList = loading ? (
    <InlineLoader />
  ) : projects.length === 0 ? (
    <View style={styles.empty}>
      <BookOpen size={32} color={colors.gray300} strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>No chapters yet</Text>
      <Text style={styles.emptyText}>Add your first project to appear on your storybook.</Text>
      {!showForm ? (
        <Button title="Add first project" size="sm" icon={Plus} fullWidth={false} onPress={openAddForm} style={{ marginTop: 12 }} />
      ) : null}
    </View>
  ) : (
    <View style={styles.list}>
      {projects.map((project, index) => (
        <View key={project.id} style={styles.item}>
          <View style={styles.itemMain}>
            {project.cover_image_url ? (
              <Image source={{ uri: project.cover_image_url }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <ImageIcon size={22} color={colors.gray300} />
              </View>
            )}
            <View style={styles.flex}>
              <View style={styles.rowGap}>
                <Text style={styles.chapterNo}>Ch. {index + 1}</Text>
                <Chip label={project.published ? 'Published' : 'Draft'} tone={project.published ? 'green' : 'amber'} />
              </View>
              <Text style={styles.itemTitle}>{project.title}</Text>
              {project.project_url ? (
                <Text
                  style={styles.itemUrl}
                  numberOfLines={1}
                  onPress={() => Linking.openURL(normalizeProjectUrl(project.project_url)).catch(() => {})}
                >
                  {project.project_url.replace(/^https?:\/\//, '')}
                </Text>
              ) : null}
              {project.tags?.length > 0 ? (
                <View style={styles.tags}>
                  {project.tags.slice(0, 3).map((tag, i) => (
                    <Text key={`${tag}-${i}`} style={styles.tag}>{tag}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          <View style={styles.itemActions}>
            <View style={styles.rowGap}>
              <IconBtn onPress={() => moveProject(index, -1)} disabled={index === 0} label="Move up">
                <ChevronUp size={15} color={colors.gray500} />
              </IconBtn>
              <IconBtn onPress={() => moveProject(index, 1)} disabled={index === projects.length - 1} label="Move down">
                <ChevronDown size={15} color={colors.gray500} />
              </IconBtn>
            </View>
            <View style={styles.rowGap}>
              <IconBtn onPress={() => startEdit(project)} label="Edit">
                <Pencil size={16} color={colors.gray500} />
              </IconBtn>
              <IconBtn onPress={() => handleTogglePublished(project)} label={project.published ? 'Unpublish' : 'Publish'}>
                {project.published ? <Eye size={16} color={colors.gray500} /> : <EyeOff size={16} color={colors.gray500} />}
              </IconBtn>
              {project.project_url ? (
                <IconBtn onPress={() => Linking.openURL(normalizeProjectUrl(project.project_url)).catch(() => {})} label="Open link">
                  <ExternalLink size={16} color={colors.gray500} />
                </IconBtn>
              ) : null}
              <IconBtn onPress={() => handleDelete(project.id)} label="Delete">
                <Trash2 size={16} color={colors.red} />
              </IconBtn>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  if (embedded) {
    return (
      <View style={styles.embedded}>
        <View style={styles.embeddedHead}>
          <View style={styles.flex}>
            <Text style={styles.studioTitle}>Chapter studio</Text>
            <Text style={styles.studioText}>Add and edit project chapters here — published ones appear in the storybook above.</Text>
          </View>
        </View>
        {!showForm ? <Button title="Add project" size="sm" icon={Plus} onPress={openAddForm} /> : null}
        {error ? <Banner tone="error" message={error} /> : null}
        {formBlock}
        {projectList}
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.header}>
        <View style={styles.rowGap}>
          <BookOpen size={12} color={colors.red} />
          <Text style={[type.eyebrow, { color: colors.red }]}>Storybook portfolio</Text>
        </View>
        <Text style={styles.headerTitle}>Project chapters</Text>
        <Text style={styles.headerText}>
          Each project becomes a chapter on your portfolio story. Add a cover, description, and link — then publish when ready.
        </Text>
        <View style={styles.counts}>
          <Chip label={`${projects.length} total`} tone="white" />
          <Chip label={`${publishedCount} live`} tone="green" />
          {draftCount > 0 ? <Chip label={`${draftCount} draft${draftCount === 1 ? '' : 's'}`} tone="amber" /> : null}
        </View>
      </View>

      <View style={styles.toolbar}>
        {!showForm ? (
          <Button title="Add project" size="sm" icon={Plus} onPress={openAddForm} />
        ) : (
          <Text style={[type.eyebrow, { color: colors.gray400 }]}>Editing chapter…</Text>
        )}
        <View style={styles.toolbarRow}>
          {onOpenStorybook ? (
            <Button title="Open storybook" size="sm" variant="outline" icon={BookOpen} onPress={onOpenStorybook} style={styles.flex} />
          ) : null}
          {onPreview ? (
            <Button title="Preview" size="sm" variant="outline" icon={Eye} onPress={onPreview} style={styles.flex} />
          ) : null}
        </View>
      </View>

      {shareUrl ? (
        <View style={styles.shareBox}>
          <Text style={[type.eyebrow, { color: colors.gray400, fontSize: 9 }]}>Share when live</Text>
          <Text style={styles.shareUrl} numberOfLines={1}>{shareUrl}</Text>
          <Button
            title={copiedKey === 'share' ? 'Copied' : 'Copy'}
            size="sm"
            variant="outline"
            icon={copiedKey === 'share' ? Check : Copy}
            fullWidth={false}
            onPress={() => copy(shareUrl, 'share')}
          />
        </View>
      ) : null}

      <View style={styles.inner}>
        {error ? <Banner tone="error" message={error} /> : null}
        {formBlock}
        {projectList}
      </View>
    </View>
  );
}

function IconBtn({ children, onPress, disabled, label }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: colors.gray50 }, disabled && { opacity: 0.3 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shell: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.gray200, borderRadius: radius.xl, overflow: 'hidden' },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.gray100, backgroundColor: colors.gray50, gap: 6 },
  headerTitle: { ...fonts.black, fontSize: 20, color: colors.gray900 },
  headerText: { ...fonts.medium, fontSize: 12, lineHeight: 18, color: colors.gray500 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  toolbar: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.gray50 },
  toolbarRow: { flexDirection: 'row', gap: 8 },
  shareBox: {
    margin: 16,
    marginBottom: 0,
    padding: 12,
    backgroundColor: colors.gray50,
    borderRadius: radius.md,
    gap: 8,
  },
  shareUrl: { ...fonts.semibold, fontSize: 11, color: colors.gray500 },
  inner: { padding: 16, gap: 16 },
  embedded: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperBorder,
    borderRadius: 4,
    padding: 18,
    gap: 16,
  },
  embeddedHead: { flexDirection: 'row' },
  studioTitle: { ...fonts.black, fontSize: 13, color: colors.gray800, textTransform: 'uppercase', letterSpacing: 1.5 },
  studioText: { ...fonts.medium, fontSize: 11, lineHeight: 16, color: colors.gray500, marginTop: 4 },
  form: { gap: 14, padding: 16, backgroundColor: colors.gray50, borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg },
  coverBlock: { gap: 8 },
  coverPreview: { width: '100%', height: 150, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray200 },
  checkLabel: { ...fonts.bold, fontSize: 12, color: colors.gray600 },
  formActions: { flexDirection: 'row', gap: 8 },
  empty: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.gray200,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(249,250,251,0.5)',
  },
  emptyTitle: { ...fonts.bold, fontSize: 14, color: colors.gray500, marginTop: 10 },
  emptyText: { ...fonts.medium, fontSize: 12, color: colors.gray400, marginTop: 4, textAlign: 'center' },
  list: { gap: 12 },
  item: { borderWidth: 1, borderColor: colors.gray100, borderRadius: radius.lg, backgroundColor: colors.white, overflow: 'hidden' },
  itemMain: { flexDirection: 'row', gap: 12, padding: 14 },
  thumb: { width: 76, height: 76, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gray100 },
  thumbEmpty: { backgroundColor: colors.gray50, alignItems: 'center', justifyContent: 'center' },
  chapterNo: { ...fonts.black, fontSize: 9, color: colors.gray400, textTransform: 'uppercase', letterSpacing: 1.5 },
  itemTitle: { ...fonts.black, fontSize: 14, color: colors.gray900, marginTop: 4 },
  itemUrl: { ...fonts.semibold, fontSize: 10, color: colors.gray400, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  tag: {
    ...fonts.bold,
    fontSize: 9,
    color: colors.gray500,
    backgroundColor: colors.gray50,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray50,
    paddingTop: 6,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
});
