export type IconType = 'lucide' | 'emoji';

export interface ItemAppearance {
  icon?: string;
  iconType?: IconType;
  backgroundColor?: string;
  description?: string;
}

export interface FolderExplorerSettings {
  appearances: Record<string, ItemAppearance>;
}

export const DEFAULT_SETTINGS: FolderExplorerSettings = { appearances: {} };

export class AppearanceService {
  private readonly appearances: Record<string, ItemAppearance>;

  public constructor(settings: Partial<FolderExplorerSettings> = {}) {
    this.appearances = sanitizeAppearances(settings.appearances);
  }

  public get(path: string): ItemAppearance | undefined {
    return this.appearances[path];
  }

  public update(path: string, appearance: ItemAppearance): boolean {
    const sanitized = sanitizeAppearance(appearance);
    const clearsBackgroundColor =
      'backgroundColor' in appearance && appearance.backgroundColor === undefined;
    if (!sanitized && !clearsBackgroundColor) return false;

    const updated = { ...this.appearances[path], ...sanitized };
    if (clearsBackgroundColor) delete updated.backgroundColor;
    if (Object.keys(updated).length) this.appearances[path] = updated;
    else delete this.appearances[path];
    return true;
  }

  public reset(path: string): void {
    delete this.appearances[path];
  }

  public migratePath(oldPath: string, newPath: string): void {
    Object.entries(this.appearances).forEach(([path, appearance]) => {
      if (path !== oldPath && !path.startsWith(`${oldPath}/`)) return;
      const migratedPath = `${newPath}${path.slice(oldPath.length)}`;
      this.appearances[migratedPath] = appearance;
      delete this.appearances[path];
    });
  }

  public removePath(path: string): void {
    Object.keys(this.appearances).forEach((appearancePath) => {
      if (appearancePath === path || appearancePath.startsWith(`${path}/`)) {
        delete this.appearances[appearancePath];
      }
    });
  }

  public toSettings(): FolderExplorerSettings {
    return { appearances: { ...this.appearances } };
  }
}

function sanitizeAppearances(
  appearances: FolderExplorerSettings['appearances'] | undefined,
): Record<string, ItemAppearance> {
  if (!appearances || typeof appearances !== 'object') return {};
  return Object.entries(appearances).reduce<Record<string, ItemAppearance>>(
    (sanitized, [path, appearance]) => {
      const valid = sanitizeAppearance(appearance);
      if (valid) sanitized[path] = valid;
      return sanitized;
    },
    {},
  );
}

function sanitizeAppearance(value: unknown): ItemAppearance | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const appearance = value as ItemAppearance;
  const sanitized: ItemAppearance = {};
  if (isValidIcon(appearance.icon, appearance.iconType)) {
    sanitized.icon = appearance.icon;
    sanitized.iconType = appearance.iconType;
  }
  if (isValidColor(appearance.backgroundColor)) {
    sanitized.backgroundColor = appearance.backgroundColor;
  }
  if (isValidDescription(appearance.description)) {
    sanitized.description = appearance.description.trim();
  }
  return Object.keys(sanitized).length ? sanitized : undefined;
}

function isValidIcon(icon: unknown, type: unknown): icon is string {
  if (typeof icon !== 'string' || (type !== 'lucide' && type !== 'emoji'))
    return false;
  return type === 'emoji'
    ? Array.from(icon).length <= 4
    : /^[a-z0-9-]+$/.test(icon);
}

function isValidColor(color: unknown): color is string {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color);
}

function isValidDescription(description: unknown): description is string {
  return (
    typeof description === 'string' &&
    Boolean(description.trim()) &&
    description.trim().length <= 500
  );
}
