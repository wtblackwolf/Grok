/**
 * Bus d'événements typé, minimal et synchrone.
 *
 * `Events` est une table « nom d'événement -> type du payload ». Exemple :
 *   type MyEvents = { 'element:tap': { elementId: string }; 'wheel:cancel': void };
 *   const bus = new EventBus<MyEvents>();
 *   bus.on('element:tap', (p) => p.elementId); // p est typé
 */
export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  /** Abonne un handler ; renvoie une fonction de désabonnement. */
  on<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(type, handler);
  }

  /** Abonne un handler qui ne sera appelé qu'une seule fois. */
  once<K extends keyof Events>(type: K, handler: Handler<Events[K]>): () => void {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off<K extends keyof Events>(type: K, handler: Handler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as Handler<never>);
  }

  /**
   * Émet un événement. Les handlers sont appelés dans l'ordre d'abonnement ; une exception dans
   * l'un n'empêche pas les suivants (elle est remontée via `onError`).
   */
  emit<K extends keyof Events>(type: K, ...args: Events[K] extends void ? [] : [Events[K]]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    const payload = args[0] as Events[K];
    for (const h of [...set]) {
      try {
        (h as Handler<Events[K]>)(payload);
      } catch (err) {
        this.onError(err, String(type));
      }
    }
  }

  listenerCount<K extends keyof Events>(type: K): number {
    return this.handlers.get(type)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }

  /** Surchargable ; par défaut journalise. */
  onError: (err: unknown, type: string) => void = (err, type) => {
    console.error(`[EventBus] handler en erreur pour "${type}"`, err);
  };
}
