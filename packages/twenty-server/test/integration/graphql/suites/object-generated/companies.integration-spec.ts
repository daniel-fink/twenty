import request from 'supertest';

import { createManyOperationFactory } from 'test/integration/graphql/utils/create-many-operation-factory.util';
import { makeGraphqlAPIRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { deleteRecordsByIds } from 'test/integration/utils/delete-records-by-ids';

const client = request(`http://localhost:${APP_PORT}`);
const TEST_COMPANY_WITH_LOCATION_ID = '20202020-3a33-4b29-9a12-f1f53ef00303';
const TEST_SCHEMA_NAME = 'workspace_1wgvd1injqtife6y4rvfbu3h5';
const testLocation = {
  type: 'Point',
  coordinates: [-122.0841, 37.422],
} as const;

describe('companiesResolver (e2e)', () => {
  beforeAll(async () => {
    const createCompaniesOperation = createManyOperationFactory({
      objectMetadataSingularName: 'company',
      objectMetadataPluralName: 'companies',
      gqlFields: 'id',
      data: [
        {
          id: TEST_COMPANY_WITH_LOCATION_ID,
          name: 'Geometry Test Company',
        },
      ],
      upsert: true,
    });

    const createResponse = await makeGraphqlAPIRequest(
      createCompaniesOperation,
    );

    expect(createResponse.body.errors).toBeUndefined();

    await global.testDataSource.query(
      `UPDATE "${TEST_SCHEMA_NAME}"."company"
       SET "location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)
       WHERE "id" = $3`,
      [
        testLocation.coordinates[0],
        testLocation.coordinates[1],
        TEST_COMPANY_WITH_LOCATION_ID,
      ],
    );
  });

  afterAll(async () => {
    await deleteRecordsByIds('company', [TEST_COMPANY_WITH_LOCATION_ID]);
  });

  it('should find many companies', () => {
    const queryData = {
      query: `
        query companies {
          companies {
            edges {
              node {
                name
                employees
                idealCustomerProfile
                position
                location
                searchVector
                id
                createdAt
                updatedAt
                deletedAt
                accountOwnerId
                tagline
                workPolicy
                visaSponsorship
              }
            }
          }
        }
      `,
    };

    return client
      .post('/graphql')
      .set('Authorization', `Bearer ${APPLE_JANE_ADMIN_ACCESS_TOKEN}`)
      .send(queryData)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.errors).toBeUndefined();
      })
      .expect((res) => {
        const data = res.body.data.companies;

        expect(data).toBeDefined();
        expect(Array.isArray(data.edges)).toBe(true);

        const edges = data.edges;

        if (edges.length > 0) {
          const companies = edges[0].node;

          expect(companies).toHaveProperty('name');
          expect(companies).toHaveProperty('employees');
          expect(companies).toHaveProperty('idealCustomerProfile');
          expect(companies).toHaveProperty('position');
          expect(companies).toHaveProperty('location');
          expect(companies).toHaveProperty('searchVector');
          expect(companies).toHaveProperty('id');
          expect(companies).toHaveProperty('createdAt');
          expect(companies).toHaveProperty('updatedAt');
          expect(companies).toHaveProperty('deletedAt');
          expect(companies).toHaveProperty('accountOwnerId');
          expect(companies).toHaveProperty('tagline');
          expect(companies).toHaveProperty('workPolicy');
          expect(companies).toHaveProperty('visaSponsorship');
        }
      });
  });

  it('should read company location as GeoJSON Point geometry', () => {
    const queryData = {
      query: `
        query companies {
          companies {
            edges {
              node {
                name
                location
              }
            }
          }
        }
      `,
    };

    return client
      .post('/graphql')
      .set('Authorization', `Bearer ${APPLE_JANE_ADMIN_ACCESS_TOKEN}`)
      .send(queryData)
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeDefined();
        expect(res.body.errors).toBeUndefined();

        const nodes = res.body.data.companies.edges.map(
          (edge: { node: { name: string; location: unknown } }) => edge.node,
        );
        const companyWithLocation = nodes.find(
          (company: { location: unknown }) => company.location !== null,
        );

        if (!companyWithLocation) {
          throw new Error('Expected at least one company with a location');
        }

        expect(companyWithLocation.location).toEqual({
          type: 'Point',
          coordinates: testLocation.coordinates,
        });
      });
  });
});
