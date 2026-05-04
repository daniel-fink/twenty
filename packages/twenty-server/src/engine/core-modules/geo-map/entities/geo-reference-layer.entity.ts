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
  type GeoReferenceLayerProperty,
  type GeoReferenceLayerStyle,
} from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.types';

export enum GeoReferenceLayerStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}

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

export type GeoReferenceLayerTitle = {
  fields: string[];
  fallback: 'featureId';
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

  @Column('jsonb', { nullable: false })
  source: GeoReferenceLayerSource;

  @Column('jsonb', { nullable: false })
  tile: GeoReferenceLayerTile;

  @Column('jsonb', { nullable: false })
  style: GeoReferenceLayerStyle;

  @Column('jsonb', { nullable: false })
  title: GeoReferenceLayerTitle;

  @Column('jsonb', { nullable: false, default: [] })
  exposedProperties: GeoReferenceLayerProperty[];

  @Column({ nullable: true, type: 'text' })
  propertyManifestPath: string | null;

  @Column({ nullable: false, type: 'int', default: 1 })
  catalogVersion: number;

  @Column({ nullable: false, type: 'timestamptz' })
  lastSyncAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
