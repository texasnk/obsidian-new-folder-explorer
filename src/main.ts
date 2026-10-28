import {
  MarkdownView,
  Plugin,
  TFile,
  type TAbstractFile,
} from 'obsidian';
import {
  AppearanceService,
  DEFAULT_SETTINGS,
  type FolderExplorerSettings,
} from './services/appearance-service';
import { createNoteMetadataEditorExtension } from './editor/note-metadata-extension';
import { NoteMetadataService } from './services/note-metadata-service';
import {
  FOLDER_EXPLORER_VIEW_TYPE,
  FolderExplorerView,
} from './views/folder-explorer-view';

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;

interface PreviewMetadataHeader {
  container: HTMLElement;
  filePath: string;
  header: ReturnType<NoteMetadataService['createHeader']>;
}

export default class FolderExplorerPlugin extends Plugin {
  private appearanceService = new AppearanceService(DEFAULT_SETTINGS);
  private noteMetadataService = new NoteMetadataService(this.app, {
    openFolder: (path) => this.activateView(path),
    isAmbientBackgroundEnabled: (path) =>
      this.isNoteAmbientBackgroundEnabled(path),
    toggleAmbientBackground: (path) => this.toggleNoteAmbientBackground(path),
  });
  private metadataRefreshTimeout: TimeoutHandle | null = null;
  private readonly noteAmbientBackgroundDisabledPaths = new Set<string>();
  private readonly noteAmbientLayers = new Map<MarkdownView, HTMLElement>();
  private readonly notePreviewHeaders = new Map<
    MarkdownView,
    PreviewMetadataHeader
  >();

  public async onload(): Promise<void> {
    const settings =
      (await this.loadData()) as Partial<FolderExplorerSettings> | null;
    this.appearanceService = new AppearanceService(
      settings ?? DEFAULT_SETTINGS,
    );
    this.noteMetadataService = new NoteMetadataService(this.app, {
      openFolder: (path) => this.activateView(path),
      isAmbientBackgroundEnabled: (path) =>
        this.isNoteAmbientBackgroundEnabled(path),
      toggleAmbientBackground: (path) => this.toggleNoteAmbientBackground(path),
    });
    this.registerView(
      FOLDER_EXPLORER_VIEW_TYPE,
      (leaf) =>
        new FolderExplorerView(
          leaf,
          this.appearanceService,
          () => void this.saveAppearances(),
        ),
    );
    this.addRibbonIcon(
      'folder-search',
      'Open Folder Explorer',
      () => void this.activateView(),
    );
    this.addCommand({
      id: 'open-folder-explorer',
      name: 'Open Folder Explorer',
      callback: () => void this.activateView(),
    });
    this.registerEditorExtension(
      createNoteMetadataEditorExtension(this.noteMetadataService),
    );
    this.registerEvent(
      this.app.workspace.on('layout-change', () => this.syncMarkdownViews()),
    );
    this.registerEvent(
      this.app.workspace.on('file-open', () => this.syncMarkdownViews()),
    );
    this.registerEvent(this.app.vault.on('create', () => this.refreshViews()));
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile) this.scheduleMetadataRefresh();
      }),
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        this.appearanceService.removePath(file.path);
        this.removeNoteAmbientBackgroundPreference(file.path);
        void this.saveAppearances();
        this.noteMetadataService.refreshAll();
        this.refreshViews();
      }),
    );
    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        this.migrateNoteAmbientBackgroundPreference(oldPath, file.path);
        this.noteMetadataService.migratePath(oldPath, file.path);
        this.renameViews(oldPath, file.path);
        this.syncMarkdownViews();
      }),
    );
    this.syncMarkdownViews();
  }

  public async onunload(): Promise<void> {
    if (this.metadataRefreshTimeout !== null) {
      globalThis.clearTimeout(this.metadataRefreshTimeout);
    }
    this.noteAmbientLayers.forEach((layer, view) => {
      layer.remove();
      view.containerEl.removeClass('folder-explorer-note-ambient-host');
    });
    this.noteAmbientLayers.clear();
    this.notePreviewHeaders.forEach(({ container, header }) => {
      header.destroy();
      container.remove();
    });
    this.notePreviewHeaders.clear();
    this.app.workspace.detachLeavesOfType(FOLDER_EXPLORER_VIEW_TYPE);
  }

  private async activateView(path?: string): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(FOLDER_EXPLORER_VIEW_TYPE)[0];
    if (!leaf) leaf = workspace.getLeaf('tab');
    await leaf.setViewState({ type: FOLDER_EXPLORER_VIEW_TYPE, active: true });
    if (path !== undefined) {
      (leaf.view as FolderExplorerView).navigateTo(path);
    }
    workspace.revealLeaf(leaf);
  }

  private refreshViews(): void {
    this.app.workspace
      .getLeavesOfType(FOLDER_EXPLORER_VIEW_TYPE)
      .forEach((leaf) => (leaf.view as FolderExplorerView).refresh());
  }

  private renameViews(oldPath: string, newPath: string): void {
    this.appearanceService.migratePath(oldPath, newPath);
    void this.saveAppearances();
    this.app.workspace
      .getLeavesOfType(FOLDER_EXPLORER_VIEW_TYPE)
      .forEach((leaf) =>
        (leaf.view as FolderExplorerView).handleRename(oldPath, newPath),
      );
  }

  private async saveAppearances(): Promise<void> {
    await this.saveData(this.appearanceService.toSettings());
  }

  private scheduleMetadataRefresh(): void {
    if (this.metadataRefreshTimeout !== null) {
      globalThis.clearTimeout(this.metadataRefreshTimeout);
    }
    this.metadataRefreshTimeout = globalThis.setTimeout(() => {
      this.metadataRefreshTimeout = null;
      this.noteMetadataService.refreshAll();
    }, 350);
  }

  private isNoteAmbientBackgroundEnabled(path: string): boolean {
    return !this.noteAmbientBackgroundDisabledPaths.has(path);
  }

  private toggleNoteAmbientBackground(path: string): void {
    if (this.noteAmbientBackgroundDisabledPaths.has(path)) {
      this.noteAmbientBackgroundDisabledPaths.delete(path);
    } else {
      this.noteAmbientBackgroundDisabledPaths.add(path);
    }
    this.syncNoteAmbientBackgrounds();
    this.noteMetadataService.refreshAll();
  }

  private syncNoteAmbientBackgrounds(): void {
    const activeViews = new Set<MarkdownView>();
    this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) return;
      const file = view.file;
      if (!file) return;

      activeViews.add(view);
      let layer = this.noteAmbientLayers.get(view);
      if (!layer) {
        layer = view.containerEl.createDiv({
          cls: 'folder-explorer-note-ambient',
        });
        view.containerEl.prepend(layer);
        view.containerEl.addClass('folder-explorer-note-ambient-host');
        this.noteAmbientLayers.set(view, layer);
      }
      layer.toggleClass(
        'is-visible',
        this.isNoteAmbientBackgroundEnabled(file.path),
      );
    });

    this.noteAmbientLayers.forEach((layer, view) => {
      if (activeViews.has(view)) return;
      layer.remove();
      view.containerEl.removeClass('folder-explorer-note-ambient-host');
      this.noteAmbientLayers.delete(view);
    });
  }

  private syncMarkdownViews(): void {
    this.syncNoteAmbientBackgrounds();
    this.syncNotePreviewHeaders();
  }

  private syncNotePreviewHeaders(): void {
    const activeViews = new Set<MarkdownView>();
    this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView) || view.getMode() !== 'preview') {
        return;
      }
      const file = view.file;
      if (!file) return;

      activeViews.add(view);
      const existing = this.notePreviewHeaders.get(view);
      if (existing?.filePath === file.path && existing.container.isConnected) {
        return;
      }
      if (existing) this.removePreviewHeader(view, existing);

      const container = view.previewMode.containerEl.createDiv({
        cls: 'folder-explorer-note-metadata-panel',
      });
      view.previewMode.containerEl.prepend(container);
      this.notePreviewHeaders.set(view, {
        container,
        filePath: file.path,
        header: this.noteMetadataService.createHeader(container, file.path),
      });
    });

    this.notePreviewHeaders.forEach((header, view) => {
      if (!activeViews.has(view)) this.removePreviewHeader(view, header);
    });
  }

  private removePreviewHeader(
    view: MarkdownView,
    header: PreviewMetadataHeader,
  ): void {
    header.header.destroy();
    header.container.remove();
    this.notePreviewHeaders.delete(view);
  }

  private migrateNoteAmbientBackgroundPreference(
    oldPath: string,
    newPath: string,
  ): void {
    [...this.noteAmbientBackgroundDisabledPaths].forEach((path) => {
      if (path !== oldPath && !path.startsWith(`${oldPath}/`)) return;
      this.noteAmbientBackgroundDisabledPaths.delete(path);
      this.noteAmbientBackgroundDisabledPaths.add(
        `${newPath}${path.slice(oldPath.length)}`,
      );
    });
  }

  private removeNoteAmbientBackgroundPreference(pathToRemove: string): void {
    [...this.noteAmbientBackgroundDisabledPaths].forEach((path) => {
      if (path === pathToRemove || path.startsWith(`${pathToRemove}/`)) {
        this.noteAmbientBackgroundDisabledPaths.delete(path);
      }
    });
  }
}
