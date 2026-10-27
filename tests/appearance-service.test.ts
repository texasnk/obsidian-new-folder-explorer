import { describe, expect, it } from 'vitest';
import { AppearanceService } from '../src/services/appearance-service';

describe('AppearanceService', () => {
  it('persists valid icon and background preferences', () => {
    const service = new AppearanceService();
    expect(
      service.update('Study/note.md', {
        icon: 'book-open',
        iconType: 'lucide',
        backgroundColor: '#D9F3E8',
      }),
    ).toBe(true);
    expect(service.toSettings().appearances['Study/note.md']).toEqual({
      icon: 'book-open',
      iconType: 'lucide',
      backgroundColor: '#D9F3E8',
    });
  });

  it('rejects invalid persisted values', () => {
    const service = new AppearanceService({
      appearances: {
        invalid: {
          icon: '<script>',
          iconType: 'lucide',
          backgroundColor: 'red',
        },
      },
    });
    expect(service.toSettings().appearances).toEqual({});
  });

  it('migrates customizations for a renamed folder and all descendants', () => {
    const service = new AppearanceService({
      appearances: {
        Study: { icon: 'folder-heart', iconType: 'lucide' },
        'Study/note.md': { backgroundColor: '#D9F3E8' },
      },
    });
    service.migratePath('Study', 'Learning');
    expect(service.get('Learning')).toEqual({
      icon: 'folder-heart',
      iconType: 'lucide',
    });
    expect(service.get('Learning/note.md')).toEqual({
      backgroundColor: '#D9F3E8',
    });
    expect(service.get('Study')).toBeUndefined();
  });

  it('restores defaults and removes deleted descendants', () => {
    const service = new AppearanceService({
      appearances: {
        Folder: { backgroundColor: '#D9F3E8' },
        'Folder/note.md': { icon: '📝', iconType: 'emoji' },
      },
    });
    service.reset('Folder');
    service.removePath('Folder');
    expect(service.toSettings().appearances).toEqual({});
  });
});
