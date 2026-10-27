import { setIcon, TFile, type App } from 'obsidian';

export interface NoteMetadataNavigation {
  openFolder(path: string): Promise<void>;
  isAmbientBackgroundEnabled(path: string): boolean;
  toggleAmbientBackground(path: string): void;
}

interface MetadataHeaderTarget {
  refresh(): void;
  migratePath(oldPath: string, newPath: string): void;
}

/** Renders and synchronizes note metadata without changing note contents. */
export class NoteMetadataService {
  private readonly targets = new Set<MetadataHeaderTarget>();

  public constructor(
    private readonly app: App,
    private readonly navigation: NoteMetadataNavigation,
  ) {}

  public createHeader(
    container: HTMLElement,
    filePath: string,
  ): NoteMetadataHeader {
    const header = new NoteMetadataHeader(
      container,
      filePath,
      this.app,
      this.navigation,
      () => this.targets.delete(header),
    );
    this.targets.add(header);
    header.refresh();
    return header;
  }

  public refreshAll(): void {
    this.targets.forEach((target) => target.refresh());
  }

  public migratePath(oldPath: string, newPath: string): void {
    this.targets.forEach((target) => target.migratePath(oldPath, newPath));
  }
}

export class NoteMetadataHeader implements MetadataHeaderTarget {
  public constructor(
    private readonly container: HTMLElement,
    private filePath: string,
    private readonly app: App,
    private readonly navigation: NoteMetadataNavigation,
    private readonly onDestroy: () => void,
  ) {}

  public refresh(): void {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) {
      this.container.empty();
      return;
    }

    this.container.empty();
    this.container.addClass('folder-explorer-note-metadata');
    const breadcrumb = this.container.createDiv({
      cls: 'folder-explorer-note-metadata__breadcrumb',
      attr: { 'aria-label': 'Caminho da nota' },
    });
    this.renderBreadcrumb(breadcrumb, file);
    this.renderAmbientToggle(breadcrumb, file.path);
    const dates = this.container.createDiv({
      cls: 'folder-explorer-note-metadata__dates',
    });
    dates.createDiv({
      cls: 'folder-explorer-note-metadata__date',
      text: `Criado em: ${formatDate(file.stat.ctime)}`,
    });
    dates.createDiv({
      cls: 'folder-explorer-note-metadata__date',
      text: `Atualizado em: ${formatDate(file.stat.mtime)}`,
    });
  }

  public migratePath(oldPath: string, newPath: string): void {
    if (this.filePath === oldPath) {
      this.filePath = newPath;
    } else if (this.filePath.startsWith(`${oldPath}/`)) {
      this.filePath = `${newPath}${this.filePath.slice(oldPath.length)}`;
    }
    this.refresh();
  }

  public destroy(): void {
    this.onDestroy();
  }

  private renderBreadcrumb(container: HTMLElement, file: TFile): void {
    const segments = file.path.split('/');
    const folderSegments = segments.slice(0, -1);
    this.createFolderButton(container, '', 'Home', true);

    folderSegments.forEach((name, index) => {
      this.createSeparator(container);
      this.createFolderButton(
        container,
        folderSegments.slice(0, index + 1).join('/'),
        name,
      );
    });

    this.createSeparator(container);
    container.createSpan({
      cls: 'folder-explorer-note-metadata__current',
      text: file.basename,
      attr: { title: file.basename },
    });
  }

  private createFolderButton(
    container: HTMLElement,
    path: string,
    label: string,
    isHome = false,
  ): void {
    const button = container.createEl('button', {
      cls: 'folder-explorer-note-metadata__link',
      attr: { type: 'button', title: label },
    });
    if (isHome) setIcon(button, 'house');
    button.createSpan({ text: label });
    button.addEventListener(
      'click',
      () => void this.navigation.openFolder(path),
    );
  }

  private createSeparator(container: HTMLElement): void {
    const separator = container.createSpan({
      cls: 'folder-explorer-note-metadata__separator',
      text: '/',
      attr: { 'aria-hidden': 'true' },
    });
    separator.setAttribute('role', 'presentation');
  }

  private renderAmbientToggle(container: HTMLElement, filePath: string): void {
    const isEnabled = this.navigation.isAmbientBackgroundEnabled(filePath);
    const toggle = container.createEl('button', {
      cls: 'folder-explorer-note-metadata__ambient-toggle',
      attr: {
        type: 'button',
        'aria-label': isEnabled
          ? 'Desativar fundo decorativo'
          : 'Ativar fundo decorativo',
        title: isEnabled
          ? 'Desativar fundo decorativo'
          : 'Ativar fundo decorativo',
      },
    });
    setIcon(toggle, isEnabled ? 'sparkles' : 'sparkle');
    toggle.addEventListener('click', () =>
      this.navigation.toggleAmbientBackground(filePath),
    );
  }
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
