import type { VaultEntry } from '../services/vault-navigation-service';
import type { ItemAppearance } from '../services/appearance-service';
import { setIcon } from 'obsidian';
import { createFolderIcon, createSectionIcon } from './page-header';

export function renderFolderGrid(
  container: HTMLElement,
  folders: VaultEntry[],
  onNavigate: (path: string) => void,
  getItemCount: (path: string) => number,
  getAppearance: (path: string) => ItemAppearance | undefined,
  onContextMenu: (entry: VaultEntry, event: MouseEvent) => void,
): void {
  const section = container.createEl('section', {
    cls: 'folder-explorer__folders',
    attr: { 'aria-label': 'Subfolders' },
  });
  renderSectionHeader(section, 'folder', 'Pastas', folders.length);
  if (!folders.length) {
    section.createDiv({
      text: 'Nenhuma subpasta nesta pasta.',
      cls: 'folder-explorer__empty',
    });
    return;
  }
  const grid = section.createDiv({ cls: 'folder-explorer__grid' });
  folders.forEach((folder) => {
    const appearance = getAppearance(folder.path);
    const card = grid.createDiv({
      cls: 'folder-explorer__folder-card',
      attr: { title: folder.name },
    });
    if (appearance?.backgroundColor) {
      card.addClass('is-custom-background');
      card.style.setProperty('--item-background', appearance.backgroundColor);
    }
    const openButton = card.createEl('button', {
      cls: 'folder-explorer__folder-card-open',
      attr: { 'aria-label': `Open folder ${folder.name}` },
    });
    const iconArea = openButton.createDiv({
      cls: 'folder-explorer__folder-icon-area',
    });
    createFolderIcon(iconArea, appearance);
    openButton.createSpan({
      text: folder.name,
      cls: 'folder-explorer__folder-name',
    });
    openButton.createSpan({
      text: formatItemCount(getItemCount(folder.path)),
      cls: 'folder-explorer__folder-meta',
    });
    openButton.addEventListener('click', () => onNavigate(folder.path));
    const menuButton = card.createEl('button', {
      cls: 'folder-explorer__item-menu',
      attr: {
        'aria-label': `Open folder actions for ${folder.name}`,
        title: `Open folder actions for ${folder.name}`,
      },
    });
    setIcon(menuButton, 'ellipsis');
    menuButton.addEventListener('click', (event) =>
      onContextMenu(folder, event),
    );
    card.addEventListener('contextmenu', (event) =>
      onContextMenu(folder, event),
    );
  });
}

function renderSectionHeader(
  container: HTMLElement,
  icon: string,
  title: string,
  count: number,
): void {
  const header = container.createDiv({
    cls: 'folder-explorer__section-header',
  });
  createSectionIcon(header, icon);
  header.createEl('h2', { text: title });
  header.createSpan({ text: String(count), cls: 'folder-explorer__count' });
}

function formatItemCount(count: number): string {
  return `${count} ${count === 1 ? 'item' : 'itens'}`;
}
