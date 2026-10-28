import { Modal, setIcon } from 'obsidian';
import type { ItemAppearance } from '../services/appearance-service';

const ICONS = [
  'folder',
  'folder-heart',
  'book-open',
  'bookmark',
  'briefcase',
  'calendar-days',
  'code-2',
  'file-text',
  'graduation-cap',
  'heart',
  'lightbulb',
  'star',
];
const COLORS = [
  '#D9F3E8',
  '#DDEBFF',
  '#EDE2FF',
  '#FFF1C9',
  '#FFE4C2',
  '#FFE0EA',
  '#E6E9E7',
];

export class AppearanceModal extends Modal {
  private icon = '';
  private iconType: ItemAppearance['iconType'];
  private color = '';
  private description = '';

  public constructor(
    app: Modal['app'],
    private readonly itemName: string,
    appearance: ItemAppearance | undefined,
    private readonly supportsDescription: boolean,
    private readonly onApply: (appearance: ItemAppearance) => void,
    private readonly onReset: () => void,
  ) {
    super(app);
    this.icon = appearance?.icon ?? '';
    this.iconType = appearance?.iconType;
    this.color = appearance?.backgroundColor ?? '';
    this.description = appearance?.description ?? '';
  }

  public onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass('folder-explorer-modal');
    this.titleEl.setText(`Personalizar ${this.itemName}`);
    this.renderIconControls();
    this.renderColorControls();
    if (this.supportsDescription) this.renderDescriptionControls();
    this.renderActions();
  }

  private renderIconControls(): void {
    const section = this.contentEl.createDiv({
      cls: 'folder-explorer-modal__section',
    });
    section.createEl('h3', { text: 'Ícone' });
    const preview = section.createDiv({
      cls: 'folder-explorer-modal__preview',
    });
    this.renderPreview(preview);
    const choices = section.createDiv({ cls: 'folder-explorer-modal__icons' });
    ICONS.forEach((icon) => {
      const button = choices.createEl('button', {
        attr: { type: 'button', title: icon },
      });
      setIcon(button, icon);
      button.addEventListener('click', () => {
        this.icon = icon;
        this.iconType = 'lucide';
        this.renderPreview(preview);
      });
    });
    const input = section.createEl('input', {
      type: 'text',
      value: this.icon,
      placeholder: 'Nome Lucide ou emoji',
      cls: 'folder-explorer-modal__input',
    });
    input.addEventListener('input', () => {
      this.icon = input.value.trim();
      this.iconType = isEmoji(this.icon) ? 'emoji' : 'lucide';
      this.renderPreview(preview);
    });
  }

  private renderColorControls(): void {
    const section = this.contentEl.createDiv({
      cls: 'folder-explorer-modal__section',
    });
    section.createEl('h3', { text: 'Cor de fundo' });
    const preview = section.createDiv({
      text: 'Pré-visualização',
      cls: 'folder-explorer-modal__color-preview',
    });
    this.renderColorPreview(preview);
    const choices = section.createDiv({ cls: 'folder-explorer-modal__colors' });
    const picker = section.createEl('input', {
      type: 'color',
      value: this.color || '#D9F3E8',
      cls: 'folder-explorer-modal__picker',
    });
    const hex = section.createEl('input', {
      type: 'text',
      value: this.color,
      placeholder: '#RRGGBB',
      cls: 'folder-explorer-modal__input',
    });
    const setColor = (color: string): void => {
      this.color = color.trim().toUpperCase();
      if (/^#[0-9A-F]{6}$/.test(this.color)) picker.value = this.color;
      hex.value = this.color;
      this.renderColorPreview(preview);
    };
    COLORS.forEach((color) => {
      const button = choices.createEl('button', {
        attr: { type: 'button', 'aria-label': `Usar ${color}` },
      });
      button.style.backgroundColor = color;
      button.addEventListener('click', () => setColor(color));
    });
    const defaultColor = choices.createEl('button', {
      text: 'Usar fundo padrão',
      cls: 'folder-explorer-modal__default-color',
      attr: { type: 'button' },
    });
    defaultColor.addEventListener('click', () => setColor(''));
    picker.addEventListener('input', () => setColor(picker.value));
    picker.addEventListener('change', () => setColor(picker.value));
    hex.addEventListener('input', () => setColor(hex.value));
  }

  private renderDescriptionControls(): void {
    const section = this.contentEl.createDiv({
      cls: 'folder-explorer-modal__section',
    });
    section.createEl('h3', { text: 'Descrição' });
    const input = section.createEl('textarea', {
      value: this.description,
      placeholder: 'Adicione uma descrição para esta pasta',
      cls: 'folder-explorer-modal__input folder-explorer-modal__textarea',
      attr: { maxlength: '530' },
    });
    input.addEventListener('input', () => {
      this.description = input.value;
    });
  }

  private renderActions(): void {
    const actions = this.contentEl.createDiv({
      cls: 'folder-explorer-modal__actions',
    });
    const reset = actions.createEl('button', { text: 'Restaurar padrão' });
    reset.addEventListener('click', () => {
      this.onReset();
      this.close();
    });
    const apply = actions.createEl('button', {
      text: 'Aplicar',
      cls: 'mod-cta',
    });
    apply.addEventListener('click', () => {
      this.onApply({
        icon: this.icon || undefined,
        iconType: this.icon ? this.iconType : undefined,
        backgroundColor: this.color || undefined,
        description: this.supportsDescription
          ? this.description.trim() || undefined
          : undefined,
      });
      this.close();
    });
  }

  private renderPreview(container: HTMLElement): void {
    container.empty();
    if (!this.icon) {
      setIcon(container, 'folder');
      return;
    }
    if (this.iconType === 'emoji') {
      container.setText(this.icon);
      return;
    }
    setIcon(container, this.icon);
  }

  private renderColorPreview(container: HTMLElement): void {
    container.style.backgroundColor = /^#[0-9a-fA-F]{6}$/.test(this.color)
      ? this.color
      : '';
  }
}

function isEmoji(value: string): boolean {
  return Array.from(value).some(
    (character) => (character.codePointAt(0) ?? 0) > 127,
  );
}
