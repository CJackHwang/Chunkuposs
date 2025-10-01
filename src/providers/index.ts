import type { StorageProvider } from './StorageProvider';
import { CodemaoProvider } from './CodemaoProvider';

export function getDefaultProvider(): StorageProvider {
  return new CodemaoProvider();
}
