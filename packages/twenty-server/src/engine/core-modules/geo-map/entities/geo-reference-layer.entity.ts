import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import {
  type GeoReferenceLayerSidebarContract,
  type GeoReferenceLayerStyle,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.types';

export enum GeoReferenceLayerStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ARCHIVED = 'ARCHIVED',
}

export enum GeoReferenceLayerValidationStatus {
  NOT_VALIDATED = 'NOT_VALIDATED',
  VALID = 'VALID',
  INVALID = 'INVALID',
}

export type GeoReferenceLayerTileProvider = 'TWENTY_POSTGIS';

export type GeoReferenceLayerSecurityPolicy = {
  kind: 'AUTHENTICATED_WORKSPACE';
  propertyPolicy: 'ALLOWLIST_ONLY';
};

export type GeoReferenceLayerBounds = [number, number, number, number];

export type GeoReferenceLayerSource = {
  provider: 'TWENTY_WORKSPACE_POSTGIS' | 'EXTERNAL_POSTGIS';
  connectionKey?: string | null;
  connectionUriEnv?: string | null;
  schemaName: string;
  tableName: string;
  idColumnName: string;
  geometryColumnName: string;
  geometrySrid: number;
  geometryType: string;
};

export type GeoReferenceLayerTile = {
  minZoom: number;
  maxZoom: number;
  maxFeatureCount?: number | null;
};

@Entity({ name: 'geoReferenceLayer', schema: 'core' })
@Index('IDX_GEO_REFERENCE_LAYER_WORKSPACE_KEY', ['workspaceId', 'key'], {
  unique: true,
})
@Index('IDX_GEO_REFERENCE_LAYER_WORKSPACE_STATUS', ['workspaceId', 'status'])
export class GeoReferenceLayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<WorkspaceEntity>;

  @Column({ nullable: false, type: 'text' })
  key: string;

  @Column({ nullable: false, type: 'text', default: 'default' })
  catalogKey: string;

  @Column({ nullable: false, type: 'text' })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(GeoReferenceLayerStatus),
    nullable: false,
    default: GeoReferenceLayerStatus.ACTIVE,
  })
  status: GeoReferenceLayerStatus;

  @Column({ nullable: false, type: 'text', default: 'TWENTY_POSTGIS' })
  tileProvider: GeoReferenceLayerTileProvider;

  @Column('jsonb', { nullable: false })
  source: GeoReferenceLayerSource;

  @Column('jsonb', { nullable: false })
  tile: GeoReferenceLayerTile;

  @Column('jsonb', { nullable: false })
  style: GeoReferenceLayerStyle;

  @Column('jsonb', { nullable: false })
  sidebarContract: GeoReferenceLayerSidebarContract;

  @Column('jsonb', {
    nullable: false,
    default: () =>
      '\'{"kind":"AUTHENTICATED_WORKSPACE","propertyPolicy":"ALLOWLIST_ONLY"}\'::jsonb',
  })
  securityPolicy: GeoReferenceLayerSecurityPolicy;

  @Column({ nullable: true, type: 'text' })
  attribution: string | null;

  @Column({
    type: 'enum',
    enum: Object.values(GeoReferenceLayerValidationStatus),
    nullable: false,
    default: GeoReferenceLayerValidationStatus.NOT_VALIDATED,
  })
  validationStatus: GeoReferenceLayerValidationStatus;

  @Column({ nullable: true, type: 'text' })
  validationError: string | null;

  @Column({ nullable: true, type: 'timestamptz' })
  lastValidatedAt: Date | null;

  @Column({ nullable: true, type: 'int' })
  rowCount: number | null;

  @Column('jsonb', { nullable: true })
  bounds: GeoReferenceLayerBounds | null;

  @Column('jsonb', { nullable: false, default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ nullable: true, type: 'text' })
  sidebarContractPath: string | null;

  @Column({ nullable: false, type: 'int', default: 1 })
  catalogVersion: number;

  @Column({ nullable: false, type: 'timestamptz' })
  lastSyncAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
