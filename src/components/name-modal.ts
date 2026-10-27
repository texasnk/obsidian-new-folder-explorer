import { App, Modal } from 'obsidian';

export class NameModal extends Modal {
  private name = '';

  public constructor(
    app: App,
    private readonly title: string,
    private readonly placeholder: string,
    private readonly confirmLabel: string,
    private readonly onConfirm: (name: string) => void,
    private readonly initialName = '',
  ) {
    super(app);
  }

  public onOpen(): void {
    this.contentEl.addClass('folder-explorer-modal');
    this.titleEl.setText(this.title);
    const input = this.contentEl.createEl('input', {
      type: 'text',
      value: this.initialName,
      placeholder: this.placeholder,
      cls: 'folder-explorer-modal__input',
    });
    const actions = this.contentEl.createDiv({
      cls: 'folder-explorer-modal__actions',
    });
    const cancelButton = actions.createEl('button', { text: 'Cancelar' });
    cancelButton.addEventListener('click', () => this.close());
    const confirmButton = actions.createEl('button', {
      text: this.confirmLabel,
      cls: 'mod-cta',
    });
    const submit = (): void => {
      const trimmedName = input.value.trim();
      if (!trimmedName) return;
      this.onConfirm(trimmedName);
      this.close();
    };
    confirmButton.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });
    input.focus();
    input.setSelectionRange(0, input.value.length);
  }
}
