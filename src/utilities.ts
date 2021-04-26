import axios from 'axios';
import querystring from 'querystring';
import cheerio from 'cheerio';
import parse from 'date-fns/parse';
import { zonedTimeToUtc } from 'date-fns-tz';

import { Language, Session } from './interfaces';

/**
 * Convert a Tarjouspalvelu company slug to it's numeric ID number
 *
 * @param slug - The slug of the company to convert
 *
 * @returns Numeric company ID of the provided slug
 */
export const companySlugToId = async (slug: string): Promise<number> => {
    let id;

    await axios
        .head(`https://tarjouspalvelu.fi/${slug}`, {
            maxRedirects: 0,
        })
        .catch((error) => {
            if (
                error.response.headers.location ===
                'https://tarjouspalvelu.fi/Default/Index'
            )
                throw new Error('Invalid company slug');

            id = parseInt(
                querystring
                    .parse(error.response.headers.location.substr(14))
                    .p.toString()
            );
        });

    if (!id) throw new Error('Failed getting company ID');

    return id;
};

/**
 * Get a Tarjouspalvelu session
 *
 * @param slug - The slug of the company to get the session UUID with
 *
 * @returns Session object including the session UUID and ID
 */
export const getSession = async (slug: string): Promise<Session> => {
    let uuid, id;

    await axios
        .head(`https://tarjouspalvelu.fi/${slug}`, {
            maxRedirects: 0,
        })
        .catch((error) => {
            if (
                error.response.headers.location ===
                'https://tarjouspalvelu.fi/Default/Index'
            )
                throw new Error('Invalid company slug');

            uuid = querystring
                .parse(error.response.headers.location)
                .g.toString();
            id = error.response.headers['set-cookie']
                .join('')
                .match(/TP=(.*?);/)[1];
        });

    if (!uuid || !id) throw new Error('Failed getting session');

    return {
        uuid,
        id,
    };
};

/**
 * Log in a Tarjouspalvelu session
 *
 * @param slug     - The slug of the company to log in with (can be anyone, session is not restricted to it in any way)
 * @param username - The user name used for logging in
 * @param password - The password used for logging in
 * @param session  - Session object to be filled with the token
 *
 * @returns The given session object filled with the session token
 */
export const loginToSession = async (
    slug: string,
    username: string,
    password: string,
    session?: Session
): Promise<Session> => {
    // If no session is provided to login with, create a new session with the provided slug
    if (!session) session = await getSession(slug);

    // Get company id from the provided slug
    const companyId = await companySlugToId(slug);

    // Get WebForms inputs for the actual login request
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
                throw new Error('Failed to load page, bad session?');
            else throw new Error('Failed to load page');
        });

    const $ = cheerio.load(response.data);

    // Get the TarjPalv session token with the fetched WebForms inputs
    await axios
        .post(
            `https://tarjouspalvelu.fi/tarjouspyynnot.aspx?p=${companyId}&g=${session.uuid}`,
            querystring.stringify({
                __EVENTVALIDATION: $('[name=__EVENTVALIDATION]').attr('value'),
                __VIEWSTATE: $('[name=__VIEWSTATE]').attr('value'),
                ctl00$header$LoginView1$LoginCtrl$UserName: username,
                ctl00$header$LoginView1$LoginCtrl$Password: password,
                ctl00$header$LoginView1$LoginCtrl$btnLogin: 'Sisään', // This is required for some reason???
            }),
            {
                headers: {
                    Cookie: `ASP.NET_SessionId_TP=${session.id};`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                maxRedirects: 0,
            }
        )
        .catch((error) => {
            // TarjPalv cookie is only returned when status is 302
            if (error.response.status === 302) {
                // If for some reason the session is missing, throw an error
                if (!session)
                    throw new Error('Error in mutating session object');

                // Fill the provided session object with the token
                session.token = error.response.headers['set-cookie']
                    .join('')
                    .match(/TarjPalv=(.*?);/)[1];
            }
            // If there's no status 302 then the username/password is wrong or we ended up to some very dark place
            else throw new Error('Failed to log in, bad username/password?');
        });

    // If no token is present, then something went wrong
    if (!session.token)
        throw new Error('Failed to log in, bad username/password?');

    return session;
};

/**
 * Set the language of a Tarjouspalvelu session
 *
 * @param companyId - The ID of the company to set the language with (can be anyone, session is not restricted to it in any way)
 * @param language  - The language to set. Must be either "fi-FI", "sv-SE", "en-GB" or "da-DK".
 * @param session   - Session object to set the language for
 *
 * @returns The given session object that has the language set
 */
export const setSessionLanguage = async (
    companyId: number,
    language: Language,
    session: Session
): Promise<Session> => {
    // Get WebForms inputs for the actual login request
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
                throw new Error('Failed to load page, invalid session?');
            else throw new Error('Failed to load page');
        });

    const $ = cheerio.load(response.data);

    // Table for selecting the correct __EVENTTARGET to send
    const languageTable = {
        'fi-FI': 'ctl00$header$Kieli_fiFI',
        'sv-SE': 'ctl00$header$Kieli_svSE',
        'en-GB': 'ctl00$header$Kieli_enGB',
        'da-DK': 'ctl00$header$LinkButton1',
    };

    // Set the language with the fetched WebForms inputs
    await axios
        .post(
            `https://tarjouspalvelu.fi/tarjouspyynnot.aspx?p=${companyId}&g=${session.uuid}`,
            querystring.stringify({
                __EVENTVALIDATION: $('[name=__EVENTVALIDATION]').attr('value'),
                __VIEWSTATE: $('[name=__VIEWSTATE]').attr('value'),
                __EVENTTARGET: languageTable[language],
            }),
            {
                headers: {
                    Cookie: `ASP.NET_SessionId_TP=${session.id}; tarjouspalvelu.fi=;`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                maxRedirects: 0,
            }
        )
        .catch((error) => {
            // Language is set only when the status is 302
            if (error.response.status === 302) {
                // Get the language set from the tarjouspalvelu.fi cookie's culture param
                const setLanguage = error.response.headers['set-cookie']
                    .join('')
                    .match(/culture=(.*?)&Expires/)[1];

                if (language === setLanguage) return session;
                else throw new Error('Response has an unexpected language');
            }
            // If there's no status 302 then the username/password is wrong or we ended up to some very dark place
            else
                throw new Error('Error setting the language, invalid session?');
        });

    return session;
};

/**
 * Get the current locale of a Tarjouspalvelu session
 *
 * @param companyId - The ID of the company to get the locale with (can be anyone, session is not restricted to it in any way)
 * @param session   - Session object to get the locale from
 *
 * @returns The current locale of the session
 */
export const getSessionLanguage = async (
    companyId: number,
    session: Session
): Promise<Language> => {
    // Get the notices page of a company, where the locale is shown
    const page = await axios
        .get(
            `https://tarjouspalvelu.fi/tarjouspyynnot.aspx?p=${companyId}&g=${session.uuid}`,
            {
                headers: {
                    Cookie: `ASP.NET_SessionId_TP=${session.id}; TarjPalv=${session.token};`,
                },
                maxRedirects: 0,
            }
        )
        .catch((error) => {
            if (error.response.status === 302)
                throw new Error('Failed to load page, bad session?');
            else throw new Error('Failed to load page');
        });

    return matchLocale(page.data);
};

/**
 * Match the current locale from page HTML content
 *
 * @param html - The HTML source of the page to get the locale from
 *
 * @returns The current locale
 */
export const matchLocale = (
    html: string
): Language => {
    const locale = html.match(/__cultureInfo = {"name":"(.*?)","/);

    if (locale === null) throw new Error('Failed to match the locale');

    switch (locale[1]) {
        case 'fi-FI':
            return Language.Fi
        case 'sv-SE':
            return Language.Sv
        case 'en-GB':
            return Language.En
        case 'da-DK':
            return Language.Da
    }

    throw new Error('Failed to match the locale');
};

/**
 * Get the boolean value of a yes/no text, independent of the language
 *
 * @param text - The text of the value to be converted
 *
 * @returns Boolean dependent on the yes/no value given
 */
export const boolFromYesOrNo = (text: string): boolean => {
    switch (text.toLowerCase()) {
        case 'kyllä':
        case 'ja':
        case 'yes':
            return true;
        case 'ei':
        case 'nej':
        case 'no':
            return false;
    }

    throw new Error('Failed to form a boolean from the given text');
};

/**
 * Get the Date object of a given localized string representation of date by the locale given, and convert it to UTC from Europe/Helsinki time
 *
 * @param date   - The localized string to be converted
 * @param locale - The locale to convert the string from
 *
 * @returns Date object of the given localized date in UTC
 */
export const parseLocalizedDate = (
    date: string,
    locale: Language
): Date => {
    // Table for selecting the correct date format to use
    const languageTable = {
        'fi-FI': 'd.M.yyyy HH:mm:ss',
        'sv-SE': 'yyyy-MM-dd HH:mm:ss',
        'en-GB': 'dd/MM/yyyy HH:mm:ss',
        'da-DK': 'dd-MM-yyyy HH:mm:ss',
    };

    // Return the date with date-fns
    return zonedTimeToUtc(
        parse(date, languageTable[locale], new Date()),
        'Europe/Helsinki' // Tarjouspalvelu.fi always returns times in Helsinki time
    );
};

/**
 * Build a link for a single file attachment in a notice by its UUID. *Note: Tarjouspalvelu links are download-only by default.*
 * 
 * @param uuid - The UUID of the file to build the link from
 * 
 * @returns The link to the file
 */
export const buildAttachmentLink = (fileUuid: string): string => {
    return `https://tarjouspalvelu.fi/Document/Open/?fileType=TarjPyynTied&id=${fileUuid}`;
};

/**
 * Build a link for a all file attachments in a single notice, in a ZIP file. *Note: Tarjouspalvelu links are download-only by default.*
 * 
 * @param noticeId - The ID of the notice containing the file attachments
 * 
 * @returns The link to the ZIP file
 */
export const buildAllAttachmentsLink = (noticeId: number): string => {
    return `https://tarjouspalvelu.fi/Zip/TarjousPyynnonLiitteet/${noticeId.toString()}`;
};