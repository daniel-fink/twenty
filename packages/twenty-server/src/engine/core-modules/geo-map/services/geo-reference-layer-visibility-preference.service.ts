import { Injectable } from '@nestjs/common';

import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';

type GeoReferenceLayerVisibilityPreferences = Record<string, boolean>;

type GeoReferenceLayerVisibilityKeyValueTypeMap = {
  [key: string]: GeoReferenceLayerVisibilityPreferences;
};

const getPreferenceKey = (viewId: string) =>
  `geoMap.referenceLayerVisibility.${viewId}`;

@Injectable()
export class GeoReferenceLayerVisibilityPreferenceService {
  constructor(
    private readonly userVarsService: UserVarsService<GeoReferenceLayerVisibilityKeyValueTypeMap>,
  ) {}

  async getPreferences({
    userId,
    workspaceId,
    viewId,
  }: {
    userId: string;
    workspaceId: string;
    viewId: string;
  }): Promise<GeoReferenceLayerVisibilityPreferences> {
    return (
      (await this.userVarsService.get({
        userId,
        workspaceId,
        key: getPreferenceKey(viewId),
      })) ?? {}
    );
  }

  async setPreference({
    userId,
    workspaceId,
    viewId,
    layerId,
    isVisible,
  }: {
    userId: string;
    workspaceId: string;
    viewId: string;
    layerId: string;
    isVisible: boolean;
  }) {
    const preferences = await this.getPreferences({
      userId,
      workspaceId,
      viewId,
    });

    await this.userVarsService.set({
      userId,
      workspaceId,
      key: getPreferenceKey(viewId),
      value: {
        ...preferences,
        [layerId]: isVisible,
      },
    });
  }
}
