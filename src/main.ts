import {
  MarkdownRenderChild,
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

export default class FolderExplorerPlugin extends Plugin {
  private appearanceService = new AppearanceService(DEFAULT_SETTINGS);
  private noteMetadataService = new NoteMetadataService(this.app, {
    openFolder: (path) => this.activateView(path),
    isAmbientBackgroundEnabled: (path) =>
      this.isNoteAmbientBackgroundEnabled(path),
    toggleAmbientBackground: (path) => this.toggleNoteAmbientBackground(path),
  });
  private metadataRefreshTimeout: TimeoutHandle | null = null;
  private readonly processedPreviewDocuments = new Set<string>();
  private readonly noteAmbientBackgroundDisabledPaths = new Set<string>();
  private readonly noteAmbientLayers = new Map<MarkdownView, HTMLElement>();

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
      this.app.workspace.on('layout-change', () =>
        this.syncNoteAmbientBackgrounds(),
      ),
    );
    this.registerEvent(
      this.app.workspace.on('file-open', () => this.syncNoteAmbientBackgrounds()),
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
    this.registerMarkdownPostProcessor((element, context) => {
      if (this.processedPreviewDocuments.has(context.docId)) return;
      const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
      if (!(file instanceof TFile)) return;
      this.processedPreviewDocuments.add(context.docId);
      context.addChild(
        new NoteMetadataRenderChild(
          element,
          file.path,
          context.docId,
          this.noteMetadataService,
          this.processedPreviewDocuments,
        ),
      );
    });
    this.registerEvent(
      this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
        this.migrateNoteAmbientBackgroundPreference(oldPath, file.path);
        this.noteMetadataService.migratePath(oldPath, file.path);
        this.renameViews(oldPath, file.path);
        this.syncNoteAmbientBackgrounds();
      }),
    );
    this.syncNoteAmbientBackgrounds();
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

class NoteMetadataRenderChild extends MarkdownRenderChild {
  private header: ReturnType<NoteMetadataService['createHeader']> | null = null;

  public constructor(
    containerEl: HTMLElement,
    private readonly filePath: string,
    private readonly documentId: string,
    private readonly metadataService: NoteMetadataService,
    private readonly processedDocuments: Set<string>,
  ) {
    super(containerEl);
  }

  public onload(): void {
    const headerContainer = this.containerEl.createDiv({
      cls: 'folder-explorer-note-metadata-panel',
    });
    this.containerEl.prepend(headerContainer);
    this.header = this.metadataService.createHeader(
      headerContainer,
      this.filePath,
    );
  }

  public onunload(): void {
    this.header?.destroy();
    this.processedDocuments.delete(this.documentId);
  }
}
