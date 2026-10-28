import type { VaultEntry } from '../services/vault-navigation-service';
import type { ItemAppearance } from '../services/appearance-service';
import { setIcon } from 'obsidian';
import { createDocumentIcon, createSectionIcon } from './page-header';

export function renderNotesList(
  container: HTMLElement,
  notes: VaultEntry[],
  onOpen: (path: string) => void,
  getAppearance: (path: string) => ItemAppearance | undefined,
  onContextMenu: (entry: VaultEntry, event: MouseEvent) => void,
  selectedPaths: ReadonlySet<string>,
  onSelectionChange: (path: string, selected: boolean) => void,
  onCreateNote: () => void,
  onCreateDrawing: () => void,
  onDeleteSelected: () => void,
  isSortDescending: boolean,
  onToggleSort: () => void,
): void {
  const section = container.createEl('section', {
    cls: 'folder-explorer__notes',
    attr: { 'aria-label': 'Notes' },
  });
  const header = section.createDiv({ cls: 'folder-explorer__section-header' });
  createSectionIcon(header, 'file-text');
  header.createEl('h2', { text: 'Notas' });
  header.createSpan({
    text: String(notes.length),
    cls: 'folder-explorer__count',
  });
  const actions = header.createDiv({ cls: 'folder-explorer__section-actions' });
  const sortButton = actions.createEl('button', {
    cls: 'folder-explorer__section-action folder-explorer__sort-action',
    attr: {
      type: 'button',
      'aria-label': isSortDescending
        ? 'Ordenar de A a Z'
        : 'Ordenar de Z a A',
      title: isSortDescending ? 'Ordenar de A a Z' : 'Ordenar de Z a A',
    },
  });
  setIcon(sortButton, 'arrow-up-down');
  sortButton.addEventListener('click', onToggleSort);
  const createNoteButton = actions.createEl('button', {
    text: 'Nova nota',
    cls: 'folder-explorer__section-action',
  });
  createNoteButton.addEventListener('click', onCreateNote);
  const createDrawingButton = actions.createEl('button', {
    text: 'Novo desenho',
    cls: 'folder-explorer__section-action',
  });
  createDrawingButton.addEventListener('click', onCreateDrawing);
  if (selectedPaths.size) {
    const deleteSelectedButton = actions.createEl('button', {
      cls: 'folder-explorer__section-action is-danger',
      attr: {
        title: `Excluir ${selectedPaths.size} notas selecionadas`,
        'aria-label': `Excluir ${selectedPaths.size} notas selecionadas`,
      },
    });
    setIcon(deleteSelectedButton, 'trash-2');
    deleteSelectedButton.addEventListener('click', onDeleteSelected);
  }
  if (!notes.length) {
    section.createDiv({
      text: 'Nenhuma nota nesta pasta.',
      cls: 'folder-explorer__empty',
    });
    return;
  }
  const list = section.createEl('ul', { cls: 'folder-explorer__notes-list' });
  notes.forEach((note) => {
    const appearance = getAppearance(note.path);
    const item = list.createEl('li');
    const selection = item.createEl('input', {
      type: 'checkbox',
      cls: 'folder-explorer__note-selection',
      attr: { 'aria-label': `Selecionar nota ${note.name}` },
    });
    selection.checked = selectedPaths.has(note.path);
    selection.addEventListener('change', () =>
      onSelectionChange(note.path, selection.checked),
    );
    const button = item.createEl('button', {
      cls: 'folder-explorer__note',
      attr: { 'aria-label': `Open note ${note.name}` },
    });
    if (appearance?.backgroundColor) {
      button.addClass('is-custom-background');
      button.style.setProperty('--item-background', appearance.backgroundColor);
    }
    createDocumentIcon(button, appearance);
    button.createSpan({ text: note.name, cls: 'folder-explorer__note-name' });
    button.addEventListener('click', () => onOpen(note.path));
    button.addEventListener('contextmenu', (event) =>
      onContextMenu(note, event),
    );
    const menuButton = item.createEl('button', {
      cls: 'folder-explorer__item-menu',
      attr: {
        'aria-label': `Open note actions for ${note.name}`,
        title: `Open note actions for ${note.name}`,
      },
    });
    setIcon(menuButton, 'ellipsis');
    menuButton.addEventListener('click', (event) => onContextMenu(note, event));
  });
}
