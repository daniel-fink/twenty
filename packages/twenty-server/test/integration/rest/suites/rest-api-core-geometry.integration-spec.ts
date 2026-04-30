import {
  TEST_COMPANY_1_ID,
  TEST_COMPANY_2_ID,
} from 'test/integration/constants/test-company-ids.constants';
import { TEST_PRIMARY_LINK_URL } from 'test/integration/constants/test-primary-link-url.constant';
import { makeRestAPIRequest } from 'test/integration/rest/utils/make-rest-api-request.util';
import { deleteAllRecords } from 'test/integration/utils/delete-all-records';

const TEST_SCHEMA_NAME = 'workspace_1wgvd1injqtife6y4rvfbu3h5';

const testLocation = {
  type: 'Point',
  coordinates: [-122.0841, 37.422],
} as const;

describe('Core REST API Geometry fields', () => {
  beforeEach(async () => {
    await deleteAllRecords('person');
    await deleteAllRecords('company');
    await makeRestAPIRequest({
      method: 'post',
      path: '/companies',
      body: {
        id: TEST_COMPANY_1_ID,
        domainName: {
          primaryLinkUrl: TEST_PRIMARY_LINK_URL,
        },
      },
    });

    await global.testDataSource.query(
      `UPDATE "${TEST_SCHEMA_NAME}"."company"
       SET "location" = ST_SetSRID(ST_MakePoint($1, $2), 4326)
       WHERE "id" = $3`,
      [
        testLocation.coordinates[0],
        testLocation.coordinates[1],
        TEST_COMPANY_1_ID,
      ],
    );
  });

  afterAll(async () => {
    await deleteAllRecords('person');
    await deleteAllRecords('company');
  });

  it('should read company location as GeoJSON Point geometry', async () => {
    await makeRestAPIRequest({
      method: 'get',
      path: `/companies/${TEST_COMPANY_1_ID}`,
    })
      .expect(200)
      .expect((res) => {
        const company = res.body.data.company;

        expect(company.location.type).toBe('Point');
        expect(company.location.coordinates[0]).toBeCloseTo(
          testLocation.coordinates[0],
        );
        expect(company.location.coordinates[1]).toBeCloseTo(
          testLocation.coordinates[1],
        );
      });
  });

  it('should reject company location on create', async () => {
    const response = await makeRestAPIRequest({
      method: 'post',
      path: '/companies',
      body: {
        id: TEST_COMPANY_2_ID,
        location: testLocation,
      },
    });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain(
      'Geometry fields are read-only',
    );
  });

  it('should reject company location on update', async () => {
    const response = await makeRestAPIRequest({
      method: 'patch',
      path: `/companies/${TEST_COMPANY_1_ID}`,
      body: {
        location: testLocation,
      },
    });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).toContain(
      'Geometry fields are read-only',
    );
  });
});
