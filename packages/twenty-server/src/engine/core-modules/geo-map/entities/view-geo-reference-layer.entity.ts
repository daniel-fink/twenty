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

import { GeoReferenceLayerEntity } from 'src/engine/core-modules/geo-map/entities/geo-reference-layer.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { ViewEntity } from 'src/engine/metadata-modules/view/entities/view.entity';
import { type GeoReferenceLayerStyle } from 'src/engine/core-modules/geo-map/reference-layer-catalog/geo-reference-layer-catalog.types';

@Entity({ name: 'viewGeoReferenceLayer', schema: 'core' })
@Index(
  'IDX_VIEW_GEO_REFERENCE_LAYER_VIEW_LAYER',
  ['viewId', 'geoReferenceLayerId'],
  {
    unique: true,
  },
)
@Index('IDX_VIEW_GEO_REFERENCE_LAYER_WORKSPACE_VIEW', ['workspaceId', 'viewId'])
export class ViewGeoReferenceLayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: false, type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Relation<WorkspaceEntity>;

  @Column({ nullable: false, type: 'uuid' })
  viewId: string;

  @ManyToOne(() => ViewEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'viewId' })
  view: Relation<ViewEntity>;

  @Column({ nullable: false, type: 'uuid' })
  geoReferenceLayerId: string;

  @ManyToOne(() => GeoReferenceLayerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'geoReferenceLayerId' })
  geoReferenceLayer: Relation<GeoReferenceLayerEntity>;

  @Column({ nullable: false, type: 'double precision', default: 0 })
  position: number;

  @Column({ nullable: false, type: 'boolean', default: true })
  isVisible: boolean;

  @Column('jsonb', { nullable: true })
  styleOverride: GeoReferenceLayerStyle | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
