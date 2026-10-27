import { App, Modal } from 'obsidian';

export class ConfirmationModal extends Modal {
  public constructor(
    app: App,
    private readonly message: string,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  public onOpen(): void {
    this.contentEl.addClass('folder-explorer-modal');
    this.titleEl.setText('Confirmar exclusão');
    this.contentEl.createEl('p', { text: this.message });
    const actions = this.contentEl.createDiv({
      cls: 'folder-explorer-modal__actions',
    });
    const cancelButton = actions.createEl('button', { text: 'Cancelar' });
    cancelButton.addEventListener('click', () => this.close());
    const deleteButton = actions.createEl('button', {
      text: 'Mover para lixeira',
      cls: 'mod-warning',
    });
    deleteButton.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });
  }
}
