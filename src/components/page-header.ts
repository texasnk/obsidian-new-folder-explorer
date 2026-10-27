import { setIcon } from 'obsidian';
import type { ItemAppearance } from '../services/appearance-service';
import type { VaultEntry } from '../services/vault-navigation-service';

export function renderPageHeader(
  container: HTMLElement,
  title: string,
  breadcrumb: VaultEntry[],
  onNavigate: (path: string) => void,
  searchQuery: string,
  onSearch: (query: string) => void,
  isSearchOpen: boolean,
  onToggleSearch: () => void,
  onCloseSearch: () => void,
): void {
  const header = container.createDiv({ cls: 'folder-explorer__header' });
  const titleArea = header.createDiv({ cls: 'folder-explorer__heading' });
  titleArea.createDiv({
    text: 'VAULT EXPLORER',
    cls: 'folder-explorer__eyebrow',
  });
  titleArea.createEl('h1', { text: title, cls: 'folder-explorer__title' });
  const navigation = header.createDiv({ cls: 'folder-explorer__navigation' });
  const trail = navigation.createDiv({
    cls: 'folder-explorer__breadcrumb',
    attr: { 'aria-label': 'Folder path' },
  });

  breadcrumb.forEach((entry, index) => {
    if (index > 0)
      trail.createSpan({
        text: '/',
        cls: 'folder-explorer__separator',
        attr: { 'aria-hidden': 'true' },
      });
    const button = trail.createEl('button', {
      text: entry.name,
      cls: 'folder-explorer__breadcrumb-item',
    });
    if (index === breadcrumb.length - 1) button.addClass('is-current');
    if (index === 0) {
      button.empty();
      const homeIcon = button.createSpan({ attr: { 'aria-hidden': 'true' } });
      setIcon(homeIcon, 'house');
      button.createSpan({ text: 'Home' });
    }
    button.addEventListener('click', () => onNavigate(entry.path));
  });
  const search = navigation.createDiv({
    cls: `folder-explorer__search ${isSearchOpen ? 'is-open' : ''}`,
  });
  const toggle = search.createEl('button', {
    cls: 'folder-explorer__search-toggle',
    attr: {
      'aria-label': isSearchOpen ? 'Fechar busca' : 'Abrir busca',
      'aria-expanded': String(isSearchOpen),
    },
  });
  setIcon(toggle, isSearchOpen ? 'x' : 'search');
  toggle.addEventListener('click', () =>
    isSearchOpen ? onCloseSearch() : onToggleSearch(),
  );
  if (isSearchOpen) {
    const input = search.createEl('input', {
      type: 'search',
      value: searchQuery,
      placeholder: 'Buscar nesta pasta',
      attr: { 'aria-label': 'Buscar pastas e notas nesta pasta' },
    });
    input.addEventListener('input', () => onSearch(input.value));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') onCloseSearch();
    });
    if (searchQuery) {
      const clear = search.createEl('button', {
        cls: 'folder-explorer__search-clear',
        attr: { 'aria-label': 'Limpar busca' },
      });
      setIcon(clear, 'circle-x');
      clear.addEventListener('click', () => onSearch(''));
    }
  }
}

export function createDocumentIcon(
  container: HTMLElement,
  appearance?: ItemAppearance,
): void {
  createItemIcon(
    container,
    'file-text',
    'folder-explorer__note-icon',
    appearance,
  );
}

export function createFolderIcon(
  container: HTMLElement,
  appearance?: ItemAppearance,
): void {
  createItemIcon(
    container,
    'folder',
    'folder-explorer__folder-icon',
    appearance,
  );
}

function createItemIcon(
  container: HTMLElement,
  defaultIcon: string,
  className: string,
  appearance?: ItemAppearance,
): void {
  const icon = container.createSpan({
    cls: className,
    attr: { 'aria-hidden': 'true' },
  });
  if (appearance?.iconType === 'emoji' && appearance.icon) {
    icon.setText(appearance.icon);
    return;
  }
  setIcon(icon, appearance?.icon ?? defaultIcon);
}

export function createSectionIcon(container: HTMLElement, icon: string): void {
  createIcon(container, icon, 'folder-explorer__section-icon');
}

function createIcon(
  container: HTMLElement,
  iconName: string,
  className: string,
): void {
  const icon = container.createSpan({
    cls: className,
    attr: { 'aria-hidden': 'true' },
  });
  setIcon(icon, iconName);
}
