/**
 * Adaptateurs image / vision réels — STUBS documentés.
 *
 * ImageProvider HTTP (IMAGE_BASE_URL / IMAGE_API_KEY / IMAGE_MODEL) :
 *  - generateScene : text-to-image 16:9 (ex. 1280x720), stocker le PNG dans l'ImageStore ;
 *  - inpaint : envoyer l'image complète + un masque PNG (blanc = zone à repeindre, construit depuis
 *    `mask` ou `region`) + le prompt ; recevoir l'image complète éditée, puis découper la région
 *    (ex. avec `sharp`) pour produire le patch renvoyé au client. Recoller le résultat SEULEMENT dans
 *    le masque pour garantir que rien ne bouge ailleurs.
 *
 * VisionProvider HTTP (VISION_MODEL) :
 *  - segment : envoyer l'image (ou le recadrage de `region`) à un modèle multimodal / de segmentation,
 *    demander une liste {name, description, tags, polygon} en coordonnées normalisées ; recaler les
 *    coordonnées d'un recadrage dans le repère de l'image complète.
 */
import type { BBox, DetectedElement, ImageRef } from '@pnc/shared';
import type { GenerateSceneRequest, ImageProvider, InpaintRequest, InpaintResult, VisionProvider } from '../ports';
import { NotImplementedError } from '../llm/adapters';

export interface HttpImageConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string;
}

export class HttpImageProvider implements ImageProvider {
  constructor(readonly cfg: HttpImageConfig) {}
  async generateScene(_req: GenerateSceneRequest): Promise<ImageRef> {
    throw new NotImplementedError('HttpImageProvider.generateScene');
  }
  async inpaint(_req: InpaintRequest): Promise<InpaintResult> {
    throw new NotImplementedError('HttpImageProvider.inpaint');
  }
}

export class HttpVisionProvider implements VisionProvider {
  constructor(readonly cfg: HttpImageConfig) {}
  async segment(_image: ImageRef, _region?: BBox): Promise<DetectedElement[]> {
    throw new NotImplementedError('HttpVisionProvider.segment');
  }
}
