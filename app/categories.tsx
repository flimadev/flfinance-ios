import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import type { Category } from '@/src/db/schema';
import { ptBR } from '@/src/i18n/pt-BR';
import { layout, radius, spacing, useTheme } from '@/src/theme';
import { Button, Card, Screen, Text } from '@/src/ui';
import { useCategoryManagement } from '@/src/features/categories/useCategoryManagement';

type CategoryRow = { category: Category; level: number };

function flattenCategories(categories: Category[]): CategoryRow[] {
  const active = categories.filter((category) => category.deletedAt === null);
  const result: CategoryRow[] = [];
  const visited = new Set<string>();
  const walk = (parentId: string | null, level: number) => {
    const children = active
      .filter((category) => category.parentId === parentId)
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder || first.name.localeCompare(second.name),
      );
    for (const category of children) {
      if (visited.has(category.id)) continue;
      visited.add(category.id);
      result.push({ category, level });
      walk(category.id, level + 1);
    }
  };
  walk(null, 0);
  for (const category of active) {
    if (!visited.has(category.id)) result.push({ category, level: 0 });
  }
  return result;
}

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const {
    categories,
    tags,
    loading,
    loadError,
    createCategory,
    updateCategory,
    archiveCategory,
    restoreCategory,
    reorderCategories,
    createTag: saveTag,
  } = useCategoryManagement();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('tag.fill');
  const [color, setColor] = useState('#147A58');
  const [kind, setKind] = useState<Category['kind']>('expense');
  const [parentId, setParentId] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tagNames = tags.map((tag) => tag.name);
  const rows = useMemo(() => flattenCategories(categories), [categories]);
  const activeRows = rows.filter(({ category }) => category.archivedAt === null);
  const archivedRows = rows.filter(({ category }) => category.archivedAt !== null);
  const parentOptions = activeRows.filter(
    ({ category }) => category.kind === kind && category.id !== editing?.id,
  );

  function startEditing(category: Category) {
    setEditing(category);
    setName(category.name);
    setKind(category.kind);
    setIcon(category.icon);
    setColor(category.color);
    setParentId(category.parentId ?? '');
    setError(null);
  }

  function resetEditor() {
    setEditing(null);
    setName('');
    setIcon('tag.fill');
    setColor('#147A58');
    setKind('expense');
    setParentId('');
  }

  async function saveCategory() {
    try {
      const input = {
        name,
        kind,
        icon,
        color,
        parentId: parentId || null,
      };
      if (editing) await updateCategory(editing.id, input);
      else await createCategory(input);
      resetEditor();
      setError(null);
    } catch (saveError) {
      console.error('Não foi possível salvar a categoria.', saveError);
      setError(saveError instanceof Error ? saveError.message : ptBR.categories.saveError);
    }
  }

  async function toggleArchive(category: Category) {
    try {
      if (category.archivedAt === null) await archiveCategory(category.id);
      else await restoreCategory(category.id);
      setError(null);
    } catch (archiveError) {
      console.error('Não foi possível atualizar o arquivamento da categoria.', archiveError);
      setError(ptBR.categories.saveError);
    }
  }

  async function move(category: Category, direction: -1 | 1) {
    const siblings = activeRows
      .map((row) => row.category)
      .filter((item) => item.parentId === category.parentId)
      .sort(
        (first, second) =>
          first.sortOrder - second.sortOrder || first.name.localeCompare(second.name),
      );
    const index = siblings.findIndex((item) => item.id === category.id);
    if (!siblings[index + direction]) return;
    const reordered = siblings.slice();
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(index + direction, 0, moved);
    try {
      await reorderCategories(
        reordered.map((item, position) => ({ id: item.id, sortOrder: position })),
      );
      setError(null);
    } catch (moveError) {
      console.error('Não foi possível reordenar a categoria.', moveError);
      setError(ptBR.categories.saveError);
    }
  }

  async function createTag() {
    try {
      await saveTag({ name: newTag, color });
      setNewTag('');
      setError(null);
    } catch (tagError) {
      console.error('Não foi possível criar a tag.', tagError);
      setError(ptBR.categories.saveError);
    }
  }

  return (
    <Screen scrollable contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title">{ptBR.categories.title}</Text>
        <Text tone="secondary">{ptBR.categories.description}</Text>
      </View>

      <Card style={styles.section}>
        <Text variant="heading">{editing ? ptBR.categories.edit : ptBR.categories.new}</Text>
        <Field label={ptBR.categories.name} value={name} onChangeText={setName} />
        <Field label={ptBR.categories.icon} value={icon} onChangeText={setIcon} />
        <Field label={ptBR.categories.color} value={color} onChangeText={setColor} />
        <View style={styles.choices}>
          {(['expense', 'income'] as const).map((value) => (
            <Choice
              key={value}
              label={value === 'expense' ? ptBR.transactions.expense : ptBR.transactions.income}
              selected={kind === value}
              onPress={() => {
                setKind(value);
                setParentId('');
              }}
            />
          ))}
        </View>
        <Text variant="label">{ptBR.categories.parent}</Text>
        <View style={styles.choices}>
          <Choice
            label={ptBR.categories.noParent}
            selected={!parentId}
            onPress={() => setParentId('')}
          />
          {parentOptions.map(({ category }) => (
            <Choice
              key={category.id}
              label={category.name}
              selected={parentId === category.id}
              onPress={() => setParentId(category.id)}
            />
          ))}
        </View>
        <View style={styles.actions}>
          <Button disabled={!name.trim() || loading} onPress={() => void saveCategory()}>
            {ptBR.categories.save}
          </Button>
          {editing ? (
            <Button onPress={resetEditor} variant="secondary">
              {ptBR.categories.cancel}
            </Button>
          ) : null}
        </View>
      </Card>

      <Card style={styles.section}>
        <Text variant="heading">{ptBR.categories.listTitle}</Text>
        {loading ? <Text tone="secondary">{ptBR.categories.loading}</Text> : null}
        {activeRows.map(({ category, level }) => {
          const siblings = activeRows.filter((row) => row.category.parentId === category.parentId);
          const siblingIndex = siblings.findIndex((row) => row.category.id === category.id);
          return (
            <View
              key={category.id}
              style={[
                styles.categoryRow,
                { borderBottomColor: colors.border, paddingLeft: spacing[3] + level * spacing[4] },
              ]}
            >
              <View style={styles.categoryInfo}>
                <View style={[styles.colorDot, { backgroundColor: category.color }]} />
                <View style={styles.categoryName}>
                  <Text variant="label">{category.name}</Text>
                  <Text tone="secondary" variant="caption">
                    {category.kind === 'expense'
                      ? ptBR.transactions.expense
                      : ptBR.transactions.income}
                  </Text>
                </View>
              </View>
              <View style={styles.rowActions}>
                <IconAction
                  label={ptBR.categories.moveUp}
                  disabled={siblingIndex === 0}
                  onPress={() => void move(category, -1)}
                  symbol="up"
                />
                <IconAction
                  label={ptBR.categories.moveDown}
                  disabled={siblingIndex === siblings.length - 1}
                  onPress={() => void move(category, 1)}
                  symbol="down"
                />
                <IconAction
                  label={ptBR.categories.edit}
                  onPress={() => startEditing(category)}
                  symbol="edit"
                />
                <IconAction
                  label={ptBR.categories.archive}
                  onPress={() => void toggleArchive(category)}
                  symbol="archive"
                />
              </View>
            </View>
          );
        })}
        {archivedRows.length > 0 ? (
          <>
            <Text variant="label">{ptBR.categories.archived}</Text>
            {archivedRows.map(({ category }) => (
              <View key={category.id} style={styles.archivedRow}>
                <Text tone="secondary">{category.name}</Text>
                <Button onPress={() => void toggleArchive(category)} variant="secondary">
                  {ptBR.categories.restore}
                </Button>
              </View>
            ))}
          </>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <Text variant="heading">{ptBR.categories.tags}</Text>
        <Text tone="secondary">{ptBR.categories.tagsDescription}</Text>
        <View style={styles.tagNames}>
          {tagNames.map((tag) => (
            <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.primarySubtle }]}>
              <Text tone="primary" variant="caption">
                {tag}
              </Text>
            </View>
          ))}
        </View>
        <Field label={ptBR.categories.newTag} value={newTag} onChangeText={setNewTag} />
        <Button disabled={!newTag.trim()} onPress={() => void createTag()}>
          {ptBR.categories.createTag}
        </Button>
      </Card>

      {error || loadError ? (
        <Text accessibilityRole="alert" tone="negative">
          {error ?? loadError}
        </Text>
      ) : null}
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        allowFontScaling
        onChangeText={onChangeText}
        selectionColor={colors.primary}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
        value={value}
      />
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.primarySubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text tone={selected ? 'primary' : 'secondary'} variant="caption">
        {label}
      </Text>
    </Pressable>
  );
}

function IconAction({
  label,
  symbol,
  disabled,
  onPress,
}: {
  label: string;
  symbol: 'up' | 'down' | 'edit' | 'archive';
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const symbolNames = {
    up: { ios: 'chevron.up', android: 'keyboard_arrow_up', web: 'keyboard_arrow_up' },
    down: { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
    edit: { ios: 'pencil', android: 'edit', web: 'edit' },
    archive: { ios: 'archivebox', android: 'archive', web: 'archive' },
  } as const;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={styles.iconButton}
    >
      <SymbolView
        name={symbolNames[symbol]}
        size={18}
        tintColor={disabled ? colors.textMuted : colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing[4] },
  header: { gap: spacing[1] },
  section: { gap: spacing[3] },
  field: { gap: spacing[1] },
  input: {
    borderWidth: layout.borderWidth,
    borderRadius: radius.medium,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing[3],
    fontSize: 16,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  choice: {
    borderWidth: layout.borderWidth,
    borderRadius: radius.pill,
    minHeight: layout.touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  actions: { gap: spacing[2] },
  categoryRow: {
    minHeight: layout.touchTarget + spacing[2],
    borderBottomWidth: layout.borderWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  categoryInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  categoryName: { flex: 1 },
  colorDot: { height: spacing[3], width: spacing[3], borderRadius: radius.pill },
  rowActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivedRow: {
    minHeight: layout.touchTarget + spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagNames: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
});
