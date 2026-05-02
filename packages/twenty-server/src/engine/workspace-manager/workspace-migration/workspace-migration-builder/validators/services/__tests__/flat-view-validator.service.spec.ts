import {
  DEFAULT_GEOMETRY_FIELD_SETTINGS,
  FieldMetadataType,
  ViewOpenRecordIn,
  ViewType,
  ViewVisibility,
} from 'twenty-shared/types';

import { getFlatFieldMetadataMock } from 'src/engine/metadata-modules/flat-field-metadata/__mocks__/get-flat-field-metadata.mock';
import { ViewExceptionCode } from 'src/engine/metadata-modules/view/exceptions/view.exception';
import { type UniversalFlatView } from 'src/engine/workspace-manager/workspace-migration/universal-flat-entity/types/universal-flat-view.type';
import { FlatViewValidatorService } from 'src/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-view-validator.service';

const objectUniversalIdentifier = 'object-universal-id';
const addressFieldUniversalIdentifier = 'address-field-universal-id';

const buildMaps = (
  entities: Array<{ id?: string; universalIdentifier: string }>,
) => ({
  byUniversalIdentifier: Object.fromEntries(
    entities.map((entity) => [entity.universalIdentifier, entity]),
  ),
  universalIdentifierById: Object.fromEntries(
    entities
      .filter((entity): entity is { id: string; universalIdentifier: string } =>
        Boolean(entity.id),
      )
      .map((entity) => [entity.id, entity.universalIdentifier]),
  ),
  universalIdentifiersByApplicationId: {},
});

const baseFlatView = (
  overrides: Partial<UniversalFlatView> = {},
): UniversalFlatView => ({
  universalIdentifier: 'view-universal-id',
  applicationUniversalIdentifier: 'application-universal-id',
  name: 'Map view',
  objectMetadataUniversalIdentifier: objectUniversalIdentifier,
  type: ViewType.MAP,
  icon: 'IconMap',
  position: 0,
  isCompact: false,
  isCustom: true,
  visibility: ViewVisibility.WORKSPACE,
  openRecordIn: ViewOpenRecordIn.SIDE_PANEL,
  key: null,
  kanbanAggregateOperation: null,
  kanbanAggregateOperationFieldMetadataUniversalIdentifier: null,
  calendarLayout: null,
  calendarFieldMetadataUniversalIdentifier: null,
  mapFieldMetadataUniversalIdentifier: addressFieldUniversalIdentifier,
  mapTilePolicy: null,
  mainGroupByFieldMetadataUniversalIdentifier: null,
  shouldHideEmptyGroups: false,
  anyFieldFilterValue: null,
  createdByUserWorkspaceId: null,
  viewFieldUniversalIdentifiers: [],
  viewFilterUniversalIdentifiers: [],
  viewFilterGroupUniversalIdentifiers: [],
  viewGroupUniversalIdentifiers: [],
  viewFieldGroupUniversalIdentifiers: [],
  viewSortUniversalIdentifiers: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

const buildValidationArgs = ({
  flatView,
  mapFieldType = FieldMetadataType.ADDRESS,
  mapFieldIsActive = true,
  mapFieldObjectUniversalIdentifier = objectUniversalIdentifier,
  mapFieldSettings = null,
}: {
  flatView: UniversalFlatView;
  mapFieldType?: FieldMetadataType;
  mapFieldIsActive?: boolean;
  mapFieldObjectUniversalIdentifier?: string;
  mapFieldSettings?: object | null;
}) => ({
  flatEntityToValidate: flatView,
  optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
    flatViewMaps: buildMaps([]),
    flatObjectMetadataMaps: buildMaps([
      {
        id: 'object-id',
        universalIdentifier: objectUniversalIdentifier,
      },
    ]),
    flatFieldMetadataMaps: buildMaps([
      getFlatFieldMetadataMock({
        id: 'address-field-id',
        universalIdentifier: addressFieldUniversalIdentifier,
        objectMetadataId: 'object-id',
        objectMetadataUniversalIdentifier: mapFieldObjectUniversalIdentifier,
        type: mapFieldType,
        settings: mapFieldSettings,
        isActive: mapFieldIsActive,
      }),
    ]),
  },
});

const buildUpdateValidationArgs = ({
  existingFlatView = baseFlatView({
    type: ViewType.TABLE,
    mapFieldMetadataUniversalIdentifier: null,
  }),
  flatEntityUpdate,
  mapFieldType = FieldMetadataType.ADDRESS,
  mapFieldIsActive = true,
  mapFieldObjectUniversalIdentifier = objectUniversalIdentifier,
  mapFieldSettings = null,
}: {
  existingFlatView?: UniversalFlatView;
  flatEntityUpdate: Partial<UniversalFlatView>;
  mapFieldType?: FieldMetadataType;
  mapFieldIsActive?: boolean;
  mapFieldObjectUniversalIdentifier?: string;
  mapFieldSettings?: object | null;
}) => ({
  universalIdentifier: existingFlatView.universalIdentifier,
  flatEntityUpdate,
  optimisticFlatEntityMapsAndRelatedFlatEntityMaps: {
    flatViewMaps: buildMaps([existingFlatView]),
    flatFieldMetadataMaps: buildMaps([
      getFlatFieldMetadataMock({
        id: 'address-field-id',
        universalIdentifier: addressFieldUniversalIdentifier,
        objectMetadataId: 'object-id',
        objectMetadataUniversalIdentifier: mapFieldObjectUniversalIdentifier,
        type: mapFieldType,
        settings: mapFieldSettings,
        isActive: mapFieldIsActive,
      }),
    ]),
  },
});

describe('FlatViewValidatorService', () => {
  const service = new FlatViewValidatorService();

  it('accepts a map view backed by an active address field on the same object', () => {
    const result = service.validateFlatViewCreation(
      buildValidationArgs({
        flatView: baseFlatView(),
      }) as never,
    );

    expect(result.errors).toHaveLength(0);
  });

  it('accepts a map view backed by an active point geometry field on the same object', () => {
    const result = service.validateFlatViewCreation(
      buildValidationArgs({
        flatView: baseFlatView(),
        mapFieldType: FieldMetadataType.GEOMETRY,
        mapFieldSettings: DEFAULT_GEOMETRY_FIELD_SETTINGS,
      }) as never,
    );

    expect(result.errors).toHaveLength(0);
  });

  it('rejects a map view without a map field', () => {
    const result = service.validateFlatViewCreation(
      buildValidationArgs({
        flatView: baseFlatView({
          mapFieldMetadataUniversalIdentifier: null,
        }),
      }) as never,
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ViewExceptionCode.INVALID_VIEW_DATA,
        message: 'Map view must have a map field',
      }),
    );
  });

  it('rejects a map view backed by a non-address, non-geometry field', () => {
    const result = service.validateFlatViewCreation(
      buildValidationArgs({
        flatView: baseFlatView(),
        mapFieldType: FieldMetadataType.TEXT,
      }) as never,
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ViewExceptionCode.INVALID_VIEW_DATA,
        message: 'Map field must be an ADDRESS or GEOMETRY field',
      }),
    );
  });

  it('rejects a map view backed by an inactive address field', () => {
    const result = service.validateFlatViewCreation(
      buildValidationArgs({
        flatView: baseFlatView(),
        mapFieldIsActive: false,
      }) as never,
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ViewExceptionCode.INVALID_VIEW_DATA,
        message: 'Map field must be active',
      }),
    );
  });

  it('rejects a map view backed by an address field from another object', () => {
    const result = service.validateFlatViewCreation(
      buildValidationArgs({
        flatView: baseFlatView(),
        mapFieldObjectUniversalIdentifier: 'other-object-universal-id',
      }) as never,
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ViewExceptionCode.INVALID_VIEW_DATA,
        message: 'Map field must belong to the view object',
      }),
    );
  });

  it('accepts updating a view to map when backed by an active address field on the same object', () => {
    const result = service.validateFlatViewUpdate(
      buildUpdateValidationArgs({
        flatEntityUpdate: {
          type: ViewType.MAP,
          mapFieldMetadataUniversalIdentifier: addressFieldUniversalIdentifier,
        },
      }) as never,
    );

    expect(result.errors).toHaveLength(0);
  });

  it('rejects updating a view to map when backed by a non-address, non-geometry field', () => {
    const result = service.validateFlatViewUpdate(
      buildUpdateValidationArgs({
        flatEntityUpdate: {
          type: ViewType.MAP,
          mapFieldMetadataUniversalIdentifier: addressFieldUniversalIdentifier,
        },
        mapFieldType: FieldMetadataType.TEXT,
      }) as never,
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: ViewExceptionCode.INVALID_VIEW_DATA,
        message: 'Map field must be an ADDRESS or GEOMETRY field',
      }),
    );
  });
});
