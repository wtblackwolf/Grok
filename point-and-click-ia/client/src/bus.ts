/** Événements d'INTERFACE du client (jamais envoyés au monde : les personnages ne les perçoivent pas). */
import { EventBus, type Vec2 } from '@pnc/shared';

export type ClientEvents = {
  /** Toucher bref : point en pixels écran (client). */
  'pointer:tap': { client: Vec2 };
  /** Appui long déclenché. */
  'pointer:longpress': { client: Vec2 };
  /** Glissement pendant que la roue est ouverte. */
  'pointer:drag': { client: Vec2 };
  /** Relâchement après un appui long. */
  'pointer:release': { client: Vec2 };
  'pointer:cancel': void;
  'element:selected': { elementId: string | null; name: string | null };
  'narration': { text: string };
  'busy': { busy: boolean };
};

export const bus = new EventBus<ClientEvents>();
