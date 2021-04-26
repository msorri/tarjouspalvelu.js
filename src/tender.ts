import axios from 'axios';
import querystring from 'querystring';
import cheerio from 'cheerio';

import { Session } from './interfaces';

/**
 * Get the ID of a tender in progress by its notice number
 *
 * @param companyId - The company ID to remove the open tender from
 * @param noticeId  - The ID of the notice to get the tender ID
 * @param session   - The session to use
 *
 * @returns The ID of the tender in progress
 */
export const getTenderId = async (
    companyId: number,
    noticeId: number,
    session: Session
): Promise<string> => {
    const page = await axios
        .get(
            `https://tarjouspalvelu.fi/Tarjouspalvelu/TarjouspyynnonTarjoukset.aspx?p=${companyId}&g=${session.uuid}&tpID=${noticeId}`,
            {
                headers: {
                    Cookie: `ASP.NET_SessionId_TP=${session.id}; TarjPalv=${session.token};`,
                },
                maxRedirects: 0,
            }
        )
        .catch((error) => {
            if (error.response.status === 302)
                throw new Error(
                    'Failed to get the ID of the tender, bad session?'
                );
            else throw new Error('Failed to load tender');
        });

    const $ = cheerio.load(page.data);

    const link = $('#ctl00_PageContent_GridView1_ctl02_hlModify').attr('href');

    if (!link) throw new Error('No tenders in progress found');

    return querystring.parse(link).tarjID.toString();
};

/**
 * Remove a tender in progress from the open tenders of an account
 *
 * @param companyId - The company ID to remove the open tender from
 * @param tenderId  - The ID of the tender to remove
 * @param session   - The session to use
 */
export const removeTender = async (
    companyId: number,
    tenderId: string,
    session: Session
): Promise<void> => {
    const response = await axios
        .post(
            `https://tarjouspalvelu.fi/TarjousListaukset/PoistaKeskenerainenTarjous`,
            querystring.stringify({
                tarjousid: tenderId,
                palvelu: companyId,
            }),
            {
                headers: {
                    Cookie: `ASP.NET_SessionId_TP=${session.id}; TarjPalv=${session.token};`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        )
        .catch(() => {
            throw new Error('Error removing tender');
        });

    if (response.data.includes('{"error":true}'))
        throw new Error('Error removing tender');

    return;
};
