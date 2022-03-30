import axios from 'axios';
import cheerio from 'cheerio';

import { Notice, Session } from './interfaces';
import { matchLocale, parseLocalizedDate } from './utilities';

/**
 * Get a single notice of a company.
 *
 * @param companyId - ID of the company of the notice to get
 * @param noticeId  - ID of the notice to get
 * @param session   - The Session object to be used for getting the notice. **MUST be logged in.**
 *
 * @returns Notice object of the given notice
 */
export const getNotice = async (
    companyId: number,
    noticeId: number,
    session: Session
): Promise<Notice> => {
    // Initialize the notice by going to the full notice page - this is required for the subpages to load because the notice ID is apparently stored in the session???
    const noticePage = await axios
        .get(
            `https://tarjouspalvelu.fi/Tarjouspalvelu/tpKasittely.aspx?p=${companyId}&g=${session.uuid}&tpID=${noticeId}`,
            {
                headers: {
                    Cookie: `ASP.NET_SessionId_TP=${session.id}; TarjPalv=${session.token};`,
                },
                maxRedirects: 0,
            }
        )
        .catch((error) => {
            if (error.response.status === 302)
                throw new Error('Failed to load notice, bad session?');
            else throw new Error('Failed to load notice');
        });

    const locale = matchLocale(noticePage.data);

    const [detailsResponse, attachmentsResponse] = await Promise.all([
        // Details page
        axios
            .get(
                `https://tarjouspalvelu.fi/Tarjouspalvelu/tpReferal.aspx?g=${session.uuid}&tpID=${noticeId}`,
                {
                    headers: {
                        Cookie: `ASP.NET_SessionId_TP=${session.id}; TarjPalv=${session.token};`,
                    },
                    maxRedirects: 0,
                }
            )
            .catch((error) => {
                if (error.response.status === 302)
                    throw new Error('Failed to load notice, bad session?');
                else throw new Error('Failed to load notice');
            }),

        // Attachments page
        axios
            .get(
                `https://tarjouspalvelu.fi/Tarjouspalvelu/TarjousPyyntoLiitteet.aspx?g=${session.uuid}&tpID=${noticeId}`,
                {
                    headers: {
                        Cookie: `ASP.NET_SessionId_TP=${session.id}; TarjPalv=${session.token};`,
                    },
                    maxRedirects: 0,
                }
            )
            .catch((error) => {
                if (error.response.status === 302)
                    throw new Error('Failed to load notice, bad session?');
                else throw new Error('Failed to load notice');
            }),
    ]);

    // Initialize cheerio with the fetched responses
    const d = cheerio.load(detailsResponse.data);
    const a = cheerio.load(attachmentsResponse.data);
    const n = cheerio.load(noticePage.data);

    const notice = {
        id: noticeId,

        customId: d('#valHankTunniste').text(),

        published: parseLocalizedDate(d('#valIlmPaiva').text(), locale),

        originalPublished: d('#valIlmPaiva').text(),

        deadline:
            d('#valDueDate').text().length !== 0 // Check the length of the deadline, because even if there's no deadline the element still exists (but the others don't???)
                ? parseLocalizedDate(
                      d('#valDueDate').text().split('  (UTC')[0], // Remove the timezone indication before passing it on
                      locale
                  )
                : null, // If there is no deadline, return undefined

        originalDeadline:
            d('#valDueDate').text().length !== 0 // Check the length of the deadline, because even if there's no deadline the element still exists (but the others don't???)
                ? d('#valDueDate').text().split('  (UTC')[0] // Remove the timezone indication before passing it on
                : null, // If there is no deadline, return undefined

        unit: d('#valHankYksMarkNimi').text(),

        title: d('#valHankNimi').text(),

        flags: n('img[align="absmiddle"]')
            .map((i, el) => {
                const flag = n(el)
                    .attr('src')
                    ?.match(/ikoni_(.*?).gif/); // Remove the filename parts of the image source, leaving only the flag type part

                if (!flag) throw new Error('Failed to parse flag image');

                return flag[1];
            })
            .get(),

        types: n('span[class*="harmaa"]')
            .map((_i, el) => n(el).text())
            .get(),

        description: d('#valKuvaus').html()?.toString() ?? null, // If there's no description return null

        authorityType: d('#valHankYksLuo').text(),

        category: d('#valHankLaj').text(),

        /* procedure: d('#valHankMenet').text(), @TODO: do some logic that checks if it's a tender notice and then get these tender-specific fields

        partialTendersAccepted: boolFromYesOrNo(d('#valPartAcc').text()),

        alternativeTendersAccepted: boolFromYesOrNo(d('#valAltAcc').text()),

        reservedForWorkCenters: boolFromYesOrNo(d('#valWorkCent').text()),

        selectionCriteria: d('#valOfferSel').text(), */

        attachments: a('a[id*="TiedostoLinkki"]') // Filter to get only the file links from the page - ESPD is not needed as it is not a file per se
            .map((i, el) => {
                return {
                    fileName: a(el).text(),
                    fileUuid: a(el).attr('href')?.replace(
                        '../Document/Open/?fileType=TarjPyynTied&id=', // Replace the URL portion to get only the UUID
                        ''
                    ),
                };
            })
            .get(),

        links: a('a[id*="HyperLink1"]') // Filter to get only the links from the page
            .map((i, el) => {
                return a(el).attr('href');
            })
            .get(),
    };

    return notice; // Return the filled notice object
};
