import {
  ItemView,
  Menu,
  Notice,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
} from 'obsidian';
import { AppearanceModal } from '../components/appearance-modal';
import { ConfirmationModal } from '../components/confirmation-modal';
import { renderFolderGrid } from '../components/folder-grid';
import { renderImageGallery } from '../components/image-gallery';
import { renderNotesList } from '../components/notes-list';
import { renderPageHeader } from '../components/page-header';
import { NameModal } from '../components/name-modal';
import {
  AppearanceService,
  type ItemAppearance,
} from '../services/appearance-service';
import {
  VaultNavigationService,
  type VaultEntry,
  type VaultReader,
} from '../services/vault-navigation-service';

export const FOLDER_EXPLORER_VIEW_TYPE = 'folder-explorer-view';

interface ExcalidrawAutomateApi {
  create(parameters: {
    filename: string;
    foldername: string;
    templatePath?: string;
    onNewPane: boolean;
  }): Promise<string>;
}

export class FolderExplorerView extends ItemView {
  private currentPath = '';
  private searchQuery = '';
  private isSearchOpen = false;
  private isSortDescending = false;
  private readonly selectedNotePaths = new Set<string>();
  private readonly navigationService: VaultNavigationService;
  private pointerAnimationFrame: number | null = null;
  private pointerX = 0;
  private pointerY = 0;

  public constructor(
    leaf: WorkspaceLeaf,
    private readonly appearances: AppearanceService,
    private readonly onAppearanceChange: () => void,
  ) {
    super(leaf);
    this.navigationService = new VaultNavigationService(
      this.createVaultReader(),
    );
  }

  public getViewType(): string {
    return FOLDER_EXPLORER_VIEW_TYPE;
  }
  public getDisplayText(): string {
    return 'Folder Explorer';
  }
  public getIcon(): string {
    return 'folder-search';
  }
  public async onOpen(): Promise<void> {
    this.registerDomEvent(this.contentEl, 'pointermove', (event) =>
      this.updatePointerPosition(event),
    );
    this.render();
  }

  public async onClose(): Promise<void> {
    if (this.pointerAnimationFrame === null) return;
    this.contentEl.ownerDocument.defaultView?.cancelAnimationFrame(
      this.pointerAnimationFrame,
    );
    this.pointerAnimationFrame = null;
  }

  public refresh(): void {
    this.currentPath = this.navigationService.resolveExistingFolder(
      this.currentPath,
    );
    this.render();
  }

  public handleRename(oldPath: string, newPath: string): void {
    this.currentPath = this.navigationService.renamePath(
      this.currentPath,
      oldPath,
      newPath,
    );
    this.refresh();
  }

  public navigateTo(path: string): void {
    this.navigate(path);
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass('folder-explorer');
    this.renderAmbientBackground();
    const page = this.contentEl.createDiv({ cls: 'folder-explorer__content' });
    const folder = this.currentPath
      ? this.app.vault.getAbstractFileByPath(this.currentPath)
      : this.app.vault.getRoot();
    const title =
      folder instanceof TFolder && folder.path
        ? folder.name
        : this.app.vault.getName();
    renderPageHeader(
      page,
      title,
      this.navigationService.getBreadcrumb(
        this.currentPath,
        this.app.vault.getName(),
      ),
      (path) => this.navigate(path),
      this.searchQuery,
      (query) => this.search(query),
      this.isSearchOpen,
      () => this.openSearch(),
      () => this.closeSearch(),
    );
    const contents = this.filterContents(
      this.navigationService.getContents(this.currentPath),
    );
    renderFolderGrid(
      page,
      contents.folders,
      (path) => this.navigate(path),
      (path) => this.navigationService.getItemCount(path),
      (path) => this.appearances.get(path),
      (entry, event) => this.showContextMenu(entry, event),
      this.isSortDescending,
      () => this.toggleSortOrder(),
    );
    renderImageGallery(
      page,
      contents.images,
      (path) => this.getResourceSource(path),
      (path) => void this.openFile(path),
    );
    renderNotesList(
      page,
      contents.notes,
      (path) => void this.openNote(path),
      (path) => this.appearances.get(path),
      (entry, event) => this.showContextMenu(entry, event),
      this.selectedNotePaths,
      (path, selected) => this.setNoteSelection(path, selected),
      () => this.openCreateNoteModal(),
      () => this.openCreateDrawingModal(),
      () => this.confirmDeleteSelectedNotes(),
      this.isSortDescending,
      () => this.toggleSortOrder(),
    );
  }

  private navigate(path: string): void {
    this.currentPath = this.navigationService.resolveExistingFolder(path);
    this.searchQuery = '';
    this.render();
  }

  private renderAmbientBackground(): void {
    const background = this.contentEl.createDiv({
      cls: 'folder-explorer__ambient-background',
      attr: { 'aria-hidden': 'true' },
    });
    ['small', 'small', 'small', 'medium', 'medium', 'large', 'large'].forEach(
      (size, index) => {
        background.createSpan({
          cls: `folder-explorer__particle folder-explorer__particle--${size} folder-explorer__particle--${index + 1}`,
        });
      },
    );
  }

  private updatePointerPosition(event: MouseEvent): void {
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
    if (this.pointerAnimationFrame !== null) return;

    const window = this.contentEl.ownerDocument.defaultView;
    if (!window) return;
    this.pointerAnimationFrame = window.requestAnimationFrame(() => {
      this.contentEl.style.setProperty('--pointer-x', `${this.pointerX}px`);
      this.contentEl.style.setProperty('--pointer-y', `${this.pointerY}px`);
      this.pointerAnimationFrame = null;
    });
  }

  private search(query: string): void {
    this.searchQuery = query;
    this.render();
    this.focusSearchInput();
  }

  private openSearch(): void {
    this.isSearchOpen = true;
    this.render();
    this.focusSearchInput();
  }

  private closeSearch(): void {
    this.isSearchOpen = false;
    this.searchQuery = '';
    this.render();
  }

  private toggleSortOrder(): void {
    this.isSortDescending = !this.isSortDescending;
    this.render();
  }

  private focusSearchInput(): void {
    const input = this.contentEl.querySelector<HTMLInputElement>(
      '.folder-explorer__search input',
    );
    input?.focus();
    input?.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
  }

  private showContextMenu(entry: VaultEntry, event: MouseEvent): void {
    event.preventDefault();
    const menu = new Menu();
    menu.addItem((item) =>
      item
        .setTitle(entry.kind === 'folder' ? 'Abrir pasta' : 'Abrir nota')
        .setIcon(entry.kind === 'folder' ? 'folder-open' : 'file-text')
        .onClick(() =>
          entry.kind === 'folder'
            ? this.navigate(entry.path)
            : void this.openNote(entry.path),
        ),
    );
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle('Alterar ícone')
        .setIcon('smile')
        .onClick(() => this.openAppearanceModal(entry)),
    );
    menu.addItem((item) =>
      item
        .setTitle('Alterar cor de fundo')
        .setIcon('palette')
        .onClick(() => this.openAppearanceModal(entry)),
    );
    if (entry.kind === 'folder') {
      menu.addItem((item) =>
        item
          .setTitle('Editar descrição')
          .setIcon('align-left')
          .onClick(() => this.openAppearanceModal(entry)),
      );
    }
    menu.addItem((item) =>
      item
        .setTitle('Restaurar aparência padrão')
        .setIcon('rotate-ccw')
        .onClick(() => this.resetAppearance(entry.path)),
    );
    if (entry.kind === 'file') {
      menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle('Renomear nota')
          .setIcon('pencil')
          .onClick(() => this.openRenameNoteModal(entry)),
      );
      menu.addItem((item) =>
        item
          .setTitle('Excluir nota')
          .setIcon('trash-2')
          .onClick(() => this.confirmDeleteNotes([entry.path])),
      );
    }
    menu.showAtMouseEvent(event);
  }

  private setNoteSelection(path: string, selected: boolean): void {
    if (selected) this.selectedNotePaths.add(path);
    else this.selectedNotePaths.delete(path);
    this.render();
  }

  private openCreateNoteModal(): void {
    new NameModal(
      this.app,
      'Nova nota',
      'Nome da nota',
      'Criar nota',
      (name) => void this.createNote(name),
    ).open();
  }

  private openRenameNoteModal(note: VaultEntry): void {
    new NameModal(
      this.app,
      'Renomear nota',
      'Nome da nota',
      'Renomear',
      (name) => void this.renameNote(note.path, name),
      note.name,
    ).open();
  }

  private async renameNote(path: string, name: string): Promise<void> {
    const filename = this.toMarkdownFilename(name);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!filename || !(file instanceof TFile)) {
      new Notice('Use um nome de nota válido.');
      return;
    }
    try {
      await this.app.fileManager.renameFile(
        file,
        this.joinPath(this.currentPath, filename),
      );
    } catch {
      new Notice(
        'Não foi possível renomear a nota. Verifique se o nome já existe.',
      );
    }
  }

  private async createNote(name: string): Promise<void> {
    const filename = this.toMarkdownFilename(name);
    if (!filename) {
      new Notice('Use um nome de nota válido.');
      return;
    }
    try {
      const file = await this.app.vault.create(
        this.joinPath(this.currentPath, filename),
        '',
      );
      await this.app.workspace.getLeaf(false).openFile(file);
    } catch {
      new Notice(
        'Não foi possível criar a nota. Verifique se o nome já existe.',
      );
    }
  }

  private openCreateDrawingModal(): void {
    new NameModal(
      this.app,
      'Novo desenho',
      'Nome do desenho',
      'Criar desenho',
      (name) => void this.createDrawing(name),
    ).open();
  }

  private async createDrawing(name: string): Promise<void> {
    const filename = this.toDrawingFilename(name);
    if (!filename) {
      new Notice('Use um nome de desenho válido.');
      return;
    }
    const excalidrawAutomate = this.getExcalidrawAutomate();
    if (!excalidrawAutomate) {
      new Notice(
        'O plugin Excalidraw precisa estar ativado para criar desenhos.',
      );
      return;
    }
    try {
      await excalidrawAutomate.create({
        filename,
        foldername: this.currentPath || '/',
        onNewPane: true,
      });
      this.refresh();
    } catch {
      new Notice('Não foi possível criar o desenho.');
    }
  }

  private confirmDeleteSelectedNotes(): void {
    this.confirmDeleteNotes([...this.selectedNotePaths]);
  }

  private confirmDeleteNotes(paths: string[]): void {
    if (!paths.length) return;
    const message =
      paths.length === 1
        ? 'A nota selecionada será movida para a lixeira do vault.'
        : `${paths.length} notas selecionadas serão movidas para a lixeira do vault.`;
    new ConfirmationModal(
      this.app,
      message,
      () => void this.deleteNotes(paths),
    ).open();
  }

  private async deleteNotes(paths: string[]): Promise<void> {
    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) await this.app.vault.trash(file, true);
    }
    this.selectedNotePaths.clear();
    this.refresh();
  }

  private toMarkdownFilename(name: string): string | null {
    const trimmedName = name.trim().replace(/\.md$/i, '');
    return this.isValidFilename(trimmedName) ? `${trimmedName}.md` : null;
  }

  private toDrawingFilename(name: string): string | null {
    const trimmedName = name.trim().replace(/\.excalidraw(?:\.md)?$/i, '');
    return this.isValidFilename(trimmedName) ? trimmedName : null;
  }

  private isValidFilename(name: string): boolean {
    return Boolean(name) && !/[\\/:*?"<>|]/.test(name);
  }

  private joinPath(folderPath: string, filename: string): string {
    return folderPath ? `${folderPath}/${filename}` : filename;
  }

  private getResourceSource(path: string): string | undefined {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile
      ? this.app.vault.getResourcePath(file)
      : undefined;
  }

  private getExcalidrawAutomate(): ExcalidrawAutomateApi | null {
    const windowWithExcalidraw = this.contentEl.ownerDocument.defaultView as
      (typeof globalThis & { ExcalidrawAutomate?: unknown }) | null;
    const api = windowWithExcalidraw?.ExcalidrawAutomate;
    return this.isExcalidrawAutomateApi(api) ? api : null;
  }

  private isExcalidrawAutomateApi(
    value: unknown,
  ): value is ExcalidrawAutomateApi {
    return Boolean(
      value &&
      typeof value === 'object' &&
      'create' in value &&
      typeof value.create === 'function',
    );
  }

  private openAppearanceModal(entry: VaultEntry): void {
    new AppearanceModal(
      this.app,
      entry.name,
      this.appearances.get(entry.path),
      entry.kind === 'folder',
      (appearance) => this.updateAppearance(entry.path, appearance),
      () => this.resetAppearance(entry.path),
    ).open();
  }

  private updateAppearance(path: string, appearance: ItemAppearance): void {
    if (!this.appearances.update(path, appearance)) return;
    this.onAppearanceChange();
    this.render();
  }

  private resetAppearance(path: string): void {
    this.appearances.reset(path);
    this.onAppearanceChange();
    this.render();
  }

  private filterContents(contents: {
    folders: VaultEntry[];
    notes: VaultEntry[];
    images: VaultEntry[];
  }): { folders: VaultEntry[]; notes: VaultEntry[]; images: VaultEntry[] } {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    if (!query) {
      return {
        folders: this.sortEntries(contents.folders),
        notes: this.sortEntries(contents.notes),
        images: contents.images,
      };
    }
    const matches = (entry: VaultEntry): boolean =>
      entry.name.toLocaleLowerCase().includes(query);
    return {
      folders: this.sortEntries(contents.folders.filter(matches)),
      notes: this.sortEntries(contents.notes.filter(matches)),
      images: contents.images.filter(matches),
    };
  }

  private sortEntries(entries: VaultEntry[]): VaultEntry[] {
    return [...entries].sort((first, second) => {
      const order = first.name.localeCompare(second.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return this.isSortDescending ? -order : order;
    });
  }

  private async openNote(path: string): Promise<void> {
    await this.openFile(path);
  }

  private async openFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf('tab');
    await leaf.openFile(file, { active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  private createVaultReader(): VaultReader {
    return {
      getFolder: (path) =>
        this.toEntry(
          path
            ? this.app.vault.getAbstractFileByPath(path)
            : this.app.vault.getRoot(),
        ),
      getChildren: (path) => {
        const entry = path
          ? this.app.vault.getAbstractFileByPath(path)
          : this.app.vault.getRoot();
        return entry instanceof TFolder
          ? entry.children
              .map((child) => this.toEntry(child))
              .filter((child): child is VaultEntry => child !== null)
          : [];
      },
    };
  }

  private toEntry(file: TAbstractFile | null): VaultEntry | null {
    if (file instanceof TFolder)
      return { path: file.path, name: file.name, kind: 'folder' };
    if (file instanceof TFile)
      return {
        path: file.path,
        name: file.basename,
        kind: 'file',
        extension: file.extension,
      };
    return null;
  }
}
