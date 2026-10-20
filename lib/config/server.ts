import 'server-only';
import { parseServerConfig } from './environment';

export function getServerConfig<K extends 'billing' | 'admin' | 'analytics' | 'cleanup'>(scope: K) {
  return parseServerConfig(process.env, scope);
}
