import {
    getCompanies,
    getCompanyLogo,
    getCompanyProcurementOrganizationId,
    Company,
    Session,
    loginToSession,
    getCompanyProcurementUnits,
    getSession,
} from '../src';
import { fromBuffer } from 'file-type';

let companies: Company[], session: Session;

beforeAll(async () => {
    companies = await getCompanies();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    session = await loginToSession(13, process.env.TP_USERNAME!, process.env.TP_PASSWORD!, await getSession('helsinki'));
}, 10000); // login might be slow

test('companies list without images should have helsinki included with correct details', () => {
    expect(companies).toContainEqual({
        id: 13,
        slug: 'helsinki',
        name: 'Helsingin kaupunki',
    });
});

test('image of helsinki should be available and in correct form', async () => {
    const logo = await getCompanyLogo(13);
    expect(
        await fromBuffer(Buffer.from(logo, 'base64')) // convert the image from base64 to buffer
    ).toStrictEqual({ ext: 'png', mime: 'image/png' }); // the image should be in png format
});

test('the procurement organization id of helsinki should be 14', async () => {
    expect(
        await getCompanyProcurementOrganizationId(13, session)
    ).toStrictEqual(14);
});

test('the procurement units of helsinki should include "Helsingin kaupunki"', async () => {
    const units = await getCompanyProcurementUnits(14, session);
    expect(units).toContainEqual('Helsingin kaupunki');
});
