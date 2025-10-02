import type { StorageProvider } from './StorageProvider';
import { CodemaoProvider } from './CodemaoProvider';

export function getDefaultProvider(): StorageProvider {
  const name = (import.meta.env.VITE_DEFAULT_PROVIDER || 'codemao').toLowerCase();
  switch (name) {
    case 'codemao':
    default:
      return new CodemaoProvider();
  }
}
