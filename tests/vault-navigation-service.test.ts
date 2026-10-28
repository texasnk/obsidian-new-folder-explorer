import { describe, expect, it } from 'vitest';
import {
  VaultNavigationService,
  type VaultEntry,
  type VaultReader,
} from '../src/services/vault-navigation-service';

const folders = new Set([
  '',
  'Study',
  'Study/Architecture & Design',
  'Empty Folder',
]);
const entries: Record<string, VaultEntry[]> = {
  '': [
    { path: 'Study', name: 'Study', kind: 'folder' },
    {
      path: 'loose note.md',
      name: 'loose note',
      kind: 'file',
      extension: 'md',
    },
    { path: 'image.png', name: 'image', kind: 'file', extension: 'png' },
  ],
  Study: [
    {
      path: 'Study/Architecture & Design',
      name: 'Architecture & Design',
      kind: 'folder',
    },
    {
      path: 'Study/overview.md',
      name: 'overview',
      kind: 'file',
      extension: 'md',
    },
    {
      path: 'Study/cover.webp',
      name: 'cover',
      kind: 'file',
      extension: 'webp',
    },
  ],
  'Study/Architecture & Design': [],
  'Empty Folder': [],
};

const reader: VaultReader = {
  getFolder: (path) =>
    folders.has(path)
      ? { path, name: path.split('/').at(-1) ?? 'Vault', kind: 'folder' }
      : null,
  getChildren: (path) => entries[path] ?? [],
};

describe('VaultNavigationService', () => {
  const service = new VaultNavigationService(reader);

  it('lists only direct subfolders and Markdown notes', () => {
    expect(service.getContents('')).toEqual({
      folders: [{ path: 'Study', name: 'Study', kind: 'folder' }],
      notes: [
        {
          path: 'loose note.md',
          name: 'loose note',
          kind: 'file',
          extension: 'md',
        },
      ],
      images: [
        {
          path: 'image.png',
          name: 'image',
          kind: 'file',
          extension: 'png',
        },
      ],
    });
  });

  it('builds clickable breadcrumb paths, including spaces and special characters', () => {
    expect(
      service.getBreadcrumb('Study/Architecture & Design', 'My Vault'),
    ).toEqual([
      { path: '', name: 'My Vault', kind: 'folder' },
      { path: 'Study', name: 'Study', kind: 'folder' },
      {
        path: 'Study/Architecture & Design',
        name: 'Architecture & Design',
        kind: 'folder',
      },
    ]);
  });

  it('recognizes an empty folder', () => {
    expect(service.getContents('Empty Folder')).toEqual({
      folders: [],
      notes: [],
      images: [],
    });
  });

  it('counts direct children for a folder card', () => {
    expect(service.getItemCount('Study')).toBe(3);
  });

  it('sorts numbered names in natural order', () => {
    const numberedService = new VaultNavigationService({
      getFolder: () => null,
      getChildren: () => [
        { path: 'course-10', name: 'course-10', kind: 'folder' },
        { path: 'course-2', name: 'course-2', kind: 'folder' },
        { path: 'course-1', name: 'course-1', kind: 'folder' },
      ],
    });

    expect(numberedService.getContents('').folders.map(({ name }) => name)).toEqual(
      ['course-1', 'course-2', 'course-10'],
    );
  });

  it('separates direct images from notes and folders', () => {
    expect(service.getContents('Study').images).toMatchObject([
      { path: 'Study/cover.webp' },
    ]);
  });

  it('falls back to the nearest existing ancestor after deletion', () => {
    expect(service.resolveExistingFolder('Study/Removed/Child')).toBe('Study');
  });

  it('keeps the navigation path synchronized when an ancestor is renamed', () => {
    expect(
      service.renamePath('Study/Architecture & Design', 'Study', 'Learning'),
    ).toBe('Learning/Architecture & Design');
    expect(service.renamePath('Empty Folder', 'Study', 'Learning')).toBe(
      'Empty Folder',
    );
  });
});
