import { editorInfoField } from 'obsidian';
import type { Extension } from '@codemirror/state';
import { showPanel, type EditorView, type Panel } from '@codemirror/view';
import type { NoteMetadataService } from '../services/note-metadata-service';

/** Adds a supported CodeMirror panel above source and Live Preview content. */
export function createNoteMetadataEditorExtension(
  metadataService: NoteMetadataService,
): Extension {
  return showPanel.of((view: EditorView): Panel => {
    const container = view.dom.ownerDocument.createElement('div');
    container.addClass('folder-explorer-note-metadata-panel');
    const file = view.state.field(editorInfoField, false)?.file;
    const header = file
      ? metadataService.createHeader(container, file.path)
      : null;

    return {
      dom: container,
      top: true,
      destroy: () => header?.destroy(),
    };
  });
}
