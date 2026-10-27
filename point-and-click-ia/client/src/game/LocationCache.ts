/**
 * Instantanés locaux des lieux quittés : en revenant, on réaffiche immédiatement la dernière image
 * composée (sans re-télécharger), si elle correspond encore à la version côté serveur.
 */
export interface LocationSnapshot {
  imageId: string;
  canvas: HTMLCanvasElement;
}

export class LocationCache {
  private snapshots = new Map<string, LocationSnapshot>();

  save(locationId: string, snapshot: LocationSnapshot): void {
    this.snapshots.set(locationId, snapshot);
  }

  /** Renvoie l'instantané seulement s'il est à jour par rapport à `imageId` (sinon il est périmé). */
  get(locationId: string, imageId: string): LocationSnapshot | undefined {
    const s = this.snapshots.get(locationId);
    return s && s.imageId === imageId ? s : undefined;
  }

  clear(): void {
    this.snapshots.clear();
  }
}
