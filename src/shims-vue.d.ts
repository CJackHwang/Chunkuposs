declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // Use unknown to avoid loosening type checks too much
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}
