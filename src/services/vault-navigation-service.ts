export interface VaultEntry {
  path: string;
  name: string;
  kind: 'folder' | 'file';
  extension?: string;
}

export interface FolderContents {
  folders: VaultEntry[];
  notes: VaultEntry[];
  images: VaultEntry[];
}

export interface VaultReader {
  getFolder(path: string): VaultEntry | null;
  getChildren(path: string): VaultEntry[];
}

export class VaultNavigationService {
  public constructor(private readonly vault: VaultReader) {}

  public getContents(folderPath: string): FolderContents {
    const children = this.vault.getChildren(folderPath);
    return {
      folders: children.filter((entry) => entry.kind === 'folder').sort(byName),
      notes: children
        .filter((entry) => entry.kind === 'file' && entry.extension === 'md')
        .sort(byName),
      images: children
        .filter(
          (entry) =>
            entry.kind === 'file' &&
            entry.extension !== undefined &&
            IMAGE_EXTENSIONS.has(entry.extension.toLocaleLowerCase()),
        )
        .sort(byName),
    };
  }

  public getItemCount(folderPath: string): number {
    return this.vault.getChildren(folderPath).length;
  }

  public getBreadcrumb(folderPath: string, vaultName: string): VaultEntry[] {
    if (!folderPath) return [{ path: '', name: vaultName, kind: 'folder' }];

    const paths = folderPath.split('/');
    return [
      { path: '', name: vaultName, kind: 'folder' },
      ...paths.map((name, index) => ({
        path: paths.slice(0, index + 1).join('/'),
        name,
        kind: 'folder' as const,
      })),
    ];
  }

  public resolveExistingFolder(path: string): string {
    let candidate = path;
    while (candidate && !this.vault.getFolder(candidate)) {
      candidate = parentPath(candidate);
    }
    return candidate;
  }

  public renamePath(
    currentPath: string,
    oldPath: string,
    newPath: string,
  ): string {
    if (currentPath === oldPath) return newPath;
    if (currentPath.startsWith(`${oldPath}/`)) {
      return `${newPath}${currentPath.slice(oldPath.length)}`;
    }
    return currentPath;
  }
}

const IMAGE_EXTENSIONS = new Set([
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);

function byName(first: VaultEntry, second: VaultEntry): number {
  return first.name.localeCompare(second.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parentPath(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator === -1 ? '' : path.slice(0, separator);
}
