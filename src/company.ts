import axios from 'axios';
import cheerio from 'cheerio';
import imageToBase64 from 'image-to-base64';
import querystring from 'querystring';

import { Company, Notices, Session } from './interfaces';
import { matchLocale, parseLocalizedDate } from './utilities';

/**
 * Get all companies from the Tarjouspalvelu index page. **Note that this may exclude some companies that aren't listed there.**
 *
 * @param getLogos - Get the company logos in Base64 format
 *
 * @returns Array of the companies
 */
export const getCompanies = async (getLogos = false): Promise<Company[]> => {
    // Fetch the tarjouspalvelu index page
    const response = await axios.get('https://tarjouspalvelu.fi/Default/Index');
    if (!response)
        throw new Error('Failed getting index page from tarjouspalvelu');

    // Initialize cheerio with the fetched response
    const $ = cheerio.load(response.data);

    // Get company cells from the main table
    const companiesTable = $('tr > td');

    const companies: Company[] = [];

    for (let i = 0; i < companiesTable.length; i++) {
        // If the cell has no style, it doesn't include a company and is only used for spacing
        if (!$(companiesTable[i]).attr('style')) {
            continue;
        }

        // If the cell has a colspan attribute, it doesn't include a company and is only used for spacing
        if ($(companiesTable[i]).attr('colspan')) {
            continue;
        }

        // Get company id from the company image src attribute, omitting the image path with substr
        let id: string | undefined | number = $(
            $(companiesTable[i]).find('img')[0]
        )
            .attr('src')
            ?.substr(15);

        if (!id) throw new Error('Failed getting company id');

        id = parseInt(id);

        // Get company slug from company link, omitting the tarjouspalvelu.fi url
        const slug = $($(companiesTable[i]).find('a')[0])
            .attr('href')
            ?.substr(26);

        if (!slug) throw new Error('Failed getting company slug');

        // Get company full name from the title
        const name = $($(companiesTable[i]).find('p')[0]).text();

        // If the getLogos parameter is set, get the image in base64 format
        const logo = getLogos
            ? await imageToBase64(
                  `https://tarjouspalvelu.fi${$(
                      $(companiesTable[i]).find('img')[0]
                  ).attr('src')}`
              )
            : undefined;

        // Push the fetched company data to the companies array
        companies.push({
            id,
            slug,
            name,
            logo,
        });
    }

    // Return the filled companies array
    return companies;
};

/**
 * Get all active notices and other notices of a company. **This function currently does not support supplier registers.**
 *
 * @param companyId - ID of the company to get the notices
 * @param session   - The Session object to be used for getting the notices. Does not have to be logged in.
 *
 * @returns Notices object that includes all dynamic purchasing systems and notices
 *
 * @beta
 */
export const getNotices = async (
    companyId: number,
    session: Session
): Promise<Notices> => {
    // Fetch the tarjouspalvelu notices page
    const response = await axios
        .get(
            `https://tarjouspalvelu.fi/tarjouspyynnot.aspx?p=${companyId}&g=${session.uuid}`,
            {
                headers: { Cookie: `ASP.NET_SessionId_TP=${session.id};` },
                maxRedirects: 0,
            }
        )
        .catch((error) => {
            if (error.response.status === 302)
                throw new Error('Failed to load notices, bad session?');
            else throw new Error('Failed to load notices');
        });

    const locale = matchLocale(response.data); // Get the language of the page for date parsing

    // Initialize cheerio with the fetched response
    const $ = cheerio.load(response.data);

    // Initialize notices variable
    const notices: Notices = {
        // supplierRegisters: [],
        dynamicPurchasingSystems: [],
        notices: [],
        language: locale,
    };

    // Dynamic purchasing systems
    const dpsRows = $('#DPSIlmoituslista > tbody > tr');

    for (let i = 0; i < dpsRows.length; i++) {
        const row = $(dpsRows[i]).find('td');

        const shortDescription = $(row[3]).text().trim();

        const isBeingCorrected =
            $(row[3]).find('div').attr('class') === 'punainenfontti'
                ? true
                : false;

        notices.dynamicPurchasingSystems.push({
            id: parseInt(
                // Get the DPS id from the link to it
                querystring
                    .parse($(row[6]).find('a').attr('href') || '')
                    .tpID.toString()
            ),

            customId: $(row[1]).text().trim(),

            unit: $(row[0]).text().trim(),

            title: $(row[2]).text().trim(),

            shortDescription,

            isBeingCorrected,

            additionalDesc: isBeingCorrected
                ? shortDescription
                      .replace($(row[3]).find($('.punainenfontti')).text(), '')
                      .trim()
                : undefined,

            deadline: parseLocalizedDate($(row[4]).text().trim(), locale),

            originalDeadline: $(row[4]).text().trim(),
        });
    }

    // Notices
    const noticeRows = $('#ctl00_PageContent_GridView1 > tbody > tr');

    for (let i = 0; i < noticeRows.length; i++) {
        const row = $(noticeRows[i]).find('td');

        notices.notices.push({
            id: parseInt(
                // Get the notice id from the link to it
                querystring
                    .parse($(row[6]).find('a').attr('href') || '')
                    .tpID.toString()
            ),

            customId: $(row[0]).text().trim(),

            unit: $(row[1]).text().trim(),

            flags: $(row[2])
                .find('img')
                .map((i, el) => {
                    let flag = $(el)
                        .attr('src')
                        ?.match(/ikoni_(.*?).gif/); // Get the flag text from the icon filename

                    if (!flag)
                        flag = $(el)
                            .attr('src')
                            ?.match(/images\/(.*?)_ikoni/); // The pienhankinta icon differs from the type of it, so check it if no regular icons are found

                    if (!flag) throw new Error('Failed to parse flag image');

                    return flag[1];
                })
                .get(),

            title: $(row[2])
                .find('a')
                .text()
                .trim()
                .replace(`${$(row[0]).text().trim()} / `, ''),

            types: $(row[2])
                .find('span')
                .map((_i, el) => $(el).text())
                .get(),

            shortDescription: $(row[3]).find('span').text().trim(),

            isBeingCorrected:
                $(row[3]).find('span').css('color') === 'red' ? true : false,

            deadline:
                $(row[4]).text().trim().length !== 0
                    ? parseLocalizedDate($(row[4]).text().trim(), locale)
                    : null,

            originalDeadline:
                $(row[4]).text().trim().length !== 0
                    ? $(row[4]).text().trim()
                    : null,
        });
    }

    /* if (callType === 'sr' || callType === 'all') {
                const srCookieJar = new tough.CookieJar();
                const srResponse = await axios.post(
                    `https://tarjouspalvelu.fi/TarjousPyynto/KelpuuttamisJarjestelmatLista?pid=${companyId}`,
                    {
                        jar: srCookieJar,
                        withCredentials: true,
                        maxRedirects: 0,
                        validateStatus: (status) => status === 200,
                        headers: { Referer: 'https://tarjouspalvelu.fi/tarjouspyynnot.aspx?p=1' },
                    },
                );

                return srResponse;

                const srHtml = mainResponse.data;
                const sr$ = cheerio.load(srHtml);
            } */

    // Return the filled notices object
    return notices;
};
