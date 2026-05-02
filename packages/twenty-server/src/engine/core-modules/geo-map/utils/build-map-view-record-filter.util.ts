import {
  FieldMetadataType,
  type CompositeFieldSubFieldName,
  type PartialFieldMetadataItemOption,
  RecordFilterGroupLogicalOperator,
} from 'twenty-shared/types';
import {
  combineFilters,
  computeRecordGqlOperationFilter,
  convertViewFilterValueToString,
  getFilterTypeFromFieldType,
  isDefined,
  turnAnyFieldFilterIntoRecordGqlFilter,
} from 'twenty-shared/utils';

import { type ObjectRecordFilter } from 'src/engine/api/graphql/workspace-query-builder/interfaces/object-record.interface';
import { getFlatFieldsFromFlatObjectMetadata } from 'src/engine/api/graphql/workspace-schema-builder/utils/get-flat-fields-for-flat-object-metadata.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { type FlatViewFilterGroup } from 'src/engine/metadata-modules/flat-view-filter-group/types/flat-view-filter-group.type';
import { type FlatViewFilter } from 'src/engine/metadata-modules/flat-view-filter/types/flat-view-filter.type';
import { type FlatView } from 'src/engine/metadata-modules/flat-view/types/flat-view.type';

type BuildMapViewRecordFilterArgs = {
  flatView: FlatView;
  flatObjectMetadata: FlatObjectMetadata;
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  flatViewFilterMaps: FlatEntityMaps<FlatViewFilter>;
  flatViewFilterGroupMaps: FlatEntityMaps<FlatViewFilterGroup>;
  requestRecordFilter?: Partial<ObjectRecordFilter>;
};

const getActiveFlatViewFilters = ({
  flatViewFilterMaps,
  viewId,
}: {
  flatViewFilterMaps: FlatEntityMaps<FlatViewFilter>;
  viewId: string;
}) =>
  Object.values(flatViewFilterMaps.byUniversalIdentifier).filter(
    (flatViewFilter): flatViewFilter is FlatViewFilter =>
      isDefined(flatViewFilter) &&
      flatViewFilter.viewId === viewId &&
      flatViewFilter.deletedAt === null,
  );

const getActiveFlatViewFilterGroups = ({
  flatViewFilterGroupMaps,
  viewId,
}: {
  flatViewFilterGroupMaps: FlatEntityMaps<FlatViewFilterGroup>;
  viewId: string;
}) =>
  Object.values(flatViewFilterGroupMaps.byUniversalIdentifier).filter(
    (flatViewFilterGroup): flatViewFilterGroup is FlatViewFilterGroup =>
      isDefined(flatViewFilterGroup) &&
      flatViewFilterGroup.viewId === viewId &&
      flatViewFilterGroup.deletedAt === null,
  );

export const buildMapViewRecordFilter = ({
  flatView,
  flatObjectMetadata,
  flatFieldMetadataMaps,
  flatViewFilterMaps,
  flatViewFilterGroupMaps,
  requestRecordFilter = {},
}: BuildMapViewRecordFilterArgs): ObjectRecordFilter => {
  const activeFlatViewFilters = getActiveFlatViewFilters({
    flatViewFilterMaps,
    viewId: flatView.id,
  });

  const activeFlatViewFilterGroups = getActiveFlatViewFilterGroups({
    flatViewFilterGroupMaps,
    viewId: flatView.id,
  });

  const recordFilters = activeFlatViewFilters.map((flatViewFilter) => {
    const fieldMetadata = findFlatEntityByIdInFlatEntityMaps({
      flatEntityId: flatViewFilter.fieldMetadataId,
      flatEntityMaps: flatFieldMetadataMaps,
    });

    if (!isDefined(fieldMetadata)) {
      throw new Error(
        `Field metadata not found for field ${flatViewFilter.fieldMetadataId}`,
      );
    }

    const value =
      fieldMetadata.type === FieldMetadataType.GEOMETRY
        ? JSON.stringify(flatViewFilter.value)
        : convertViewFilterValueToString(flatViewFilter.value);

    return {
      id: flatViewFilter.id,
      fieldMetadataId: flatViewFilter.fieldMetadataId,
      value,
      type: getFilterTypeFromFieldType(fieldMetadata.type),
      operand: flatViewFilter.operand,
      recordFilterGroupId: flatViewFilter.viewFilterGroupId,
      positionInRecordFilterGroup: flatViewFilter.positionInViewFilterGroup,
      subFieldName: flatViewFilter.subFieldName as CompositeFieldSubFieldName,
    };
  });

  const recordFilterGroups = activeFlatViewFilterGroups.map(
    (flatViewFilterGroup) => ({
      id: flatViewFilterGroup.id,
      logicalOperator:
        flatViewFilterGroup.logicalOperator as unknown as RecordFilterGroupLogicalOperator,
      parentRecordFilterGroupId: flatViewFilterGroup.parentViewFilterGroupId,
    }),
  );

  const fields = getFlatFieldsFromFlatObjectMetadata(
    flatObjectMetadata,
    flatFieldMetadataMaps,
  ).map((field) => ({
    id: field.id,
    name: field.name,
    type: field.type,
    label: field.label,
    options: field.options as PartialFieldMetadataItemOption[],
  }));

  const filtersFromView = computeRecordGqlOperationFilter({
    recordFilters,
    recordFilterGroups,
    fields,
    filterValueDependencies: {
      timeZone: 'UTC',
    },
  });

  const { recordGqlOperationFilter: anyFieldFilter } =
    turnAnyFieldFilterIntoRecordGqlFilter({
      fields,
      filterValue: flatView.anyFieldFilterValue ?? '',
    });

  return combineFilters([
    requestRecordFilter,
    filtersFromView,
    anyFieldFilter,
  ]) as ObjectRecordFilter;
};
