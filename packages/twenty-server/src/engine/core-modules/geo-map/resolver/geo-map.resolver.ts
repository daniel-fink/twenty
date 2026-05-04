import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query } from '@nestjs/graphql';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { AutocompleteResultDTO } from 'src/engine/core-modules/geo-map/dtos/autocomplete-result.dto';
import { PlaceDetailsResultDTO } from 'src/engine/core-modules/geo-map/dtos/place-details-result.dto';
import { GeoReferenceLayerService } from 'src/engine/core-modules/geo-map/services/geo-reference-layer.service';
import { GeoMapService } from 'src/engine/core-modules/geo-map/services/geo-map.service';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@MetadataResolver()
@UseGuards(WorkspaceAuthGuard, NoPermissionGuard)
export class GeoMapResolver {
  constructor(
    private readonly geoMapService: GeoMapService,
    private readonly geoReferenceLayerService: GeoReferenceLayerService,
  ) {}

  @Query(() => [AutocompleteResultDTO])
  async getAutoCompleteAddress(
    @Args('address') address: string,
    @Args('token') token: string,
    @Args('country', { nullable: true }) country?: string,
    @Args('isFieldCity', { nullable: true }) isFieldCity?: boolean,
  ) {
    return this.geoMapService.getAutoCompleteAddress(
      address,
      token,
      country,
      isFieldCity,
    );
  }

  @Query(() => PlaceDetailsResultDTO)
  async getAddressDetails(
    @Args('placeId') placeId: string,
    @Args('token') token: string,
  ) {
    return this.geoMapService.getAddressDetails(placeId, token);
  }

  @Query(() => String)
  async getMapReferenceLayerVisibilityPreferences(
    @Args('viewId') viewId: string,
  ) {
    const authContext = getWorkspaceAuthContext();

    if (authContext.type !== 'user') {
      return '{}';
    }

    return JSON.stringify(
      await this.geoReferenceLayerService.getVisibilityPreferences({
        authContext,
        viewId,
      }),
    );
  }

  @Mutation(() => Boolean)
  async setMapReferenceLayerVisibilityPreference(
    @Args('viewId') viewId: string,
    @Args('layerId') layerId: string,
    @Args('isVisible') isVisible: boolean,
  ) {
    await this.geoReferenceLayerService.setVisibilityPreference({
      authContext: getWorkspaceAuthContext(),
      viewId,
      layerId,
      isVisible,
    });

    return true;
  }
}
