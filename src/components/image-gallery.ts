import { setIcon } from 'obsidian';
import type { VaultEntry } from '../services/vault-navigation-service';

export function renderImageGallery(
  container: HTMLElement,
  images: VaultEntry[],
  getImageSource: (path: string) => string | undefined,
  onOpen: (path: string) => void,
): void {
  if (!images.length) return;
  const section = container.createEl('section', {
    cls: 'folder-explorer__images',
    attr: { 'aria-label': 'Imagens' },
  });
  const header = section.createDiv({ cls: 'folder-explorer__section-header' });
  const icon = header.createSpan({ cls: 'folder-explorer__section-icon' });
  setIcon(icon, 'image');
  header.createEl('h2', { text: 'Imagens' });
  header.createSpan({
    text: String(images.length),
    cls: 'folder-explorer__count',
  });
  const grid = section.createDiv({ cls: 'folder-explorer__image-grid' });
  images.forEach((image) => {
    const source = getImageSource(image.path);
    if (!source) return;
    const button = grid.createEl('button', {
      cls: 'folder-explorer__image-card',
      attr: { title: image.name, 'aria-label': `Abrir imagem ${image.name}` },
    });
    button.createEl('img', { attr: { src: source, alt: image.name } });
    button.createSpan({ text: image.name });
    button.addEventListener('click', () => onOpen(image.path));
  });
}
