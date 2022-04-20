import axios from 'axios';
import querystring from 'querystring';
import cheerio from 'cheerio';
import parse from 'date-fns/parse';
import { zonedTimeToUtc } from 'date-fns-tz';

import { Language, Session, Notice, NoticeIdentification } from './interfaces';

/**
 * Convert a Tarjouspalvelu company slug to it's numeric ID number
 *
 * @param slug - The slug of the company to convert
 *
 * @returns Numeric company ID of the provided slug
 */
export const companySlugToId = async (slug: string): Promise<number> => {
    let id!: number;

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
    let uuid!: string, id!: string;

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
                .g.toString(); // The uuid is in the querystring
            id = error.response.headers['set-cookie']
                .join('')
                .match(/SessionId_TP=(.*?);/)[1]; // The session id is in a cookie called "ASP.NET_SessionId_TP"
        });

    return {
        uuid,
        id,
    };
};

/**
 * Log in a Tarjouspalvelu session
 *
 * @param companyId - The ID of the company to log in with (can be anyone, session is not restricted to it in any way)
 * @param username  - The user name used for logging in
 * @param password  - The password used for logging in
 * @param session   - Session object to be filled with the token
 *
 * @returns The given session object filled with the session token
 */
export const loginToSession = async (
    companyId: number,
    username: string,
    password: string,
    session: Session
): Promise<Session> => {
    // Get WebForms inputs for the actual login request
    const response = await axios
        .get(
            `https://tarjouspalvelu.fi/default.aspx?p=${companyId}&g=${session.uuid}`,
            {
                headers: { Cookie: `ASP.NET_SessionId_TP=${session.id};` },
                maxRedirects: 0,
            }
        )
        .catch(() => {
            throw new Error('Failed to load index page, bad session?');
        });

    const $ = cheerio.load(response.data);

    // Get the TarjPalv session token with the fetched WebForms inputs
    await axios
        .post(
            `https://tarjouspalvelu.fi/default.aspx?p=${companyId}&g=${session.uuid}`,
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
                // Fill the provided session object with the token
                session.token = error.response.headers['set-cookie']
                    .join('')
                    .match(/TarjPalv=(.*?);/)[1];
            }
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
 * @param language  - The language to set. Must be a Language enum value
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
            `https://tarjouspalvelu.fi/default.aspx?p=${companyId}&g=${session.uuid}`,
            {
                headers: { Cookie: `ASP.NET_SessionId_TP=${session.id};` },
                maxRedirects: 0,
            }
        )
        .catch(() => {
            throw new Error('Failed to load index page, bad session?');
        });

    const $ = cheerio.load(response.data);

    // Table for selecting the correct __EVENTTARGET to send
    const languageTable = {
        'fi-FI': 'ctl00$header$Kieli_fiFI',
        'sv-SE': 'ctl00$header$Kieli_svSE',
        'en-GB': 'ctl00$header$Kieli_enGB',
        'da-DK': 'ctl00$header$LinkButton1', // For some reason this is different?
    };

    // Set the language with the fetched WebForms inputs
    await axios
        .post(
            `https://tarjouspalvelu.fi/default.aspx?p=${companyId}&g=${session.uuid}`,
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
        });

    return session; // Return the session object given
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
                maxRedirects: 0, // If we get a 302 there is no session
            }
        )
        .catch((error) => {
            if (error.response.status === 302)
                throw new Error('Failed to load page, bad session?');
            else throw new Error('Failed to load page');
        });

    return matchLocale(page.data); // Match the locale from the page content
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
    // The locale is stored in a script element (e.g. var __cultureInfo = {"name":"fi-FI","...)
    const locale = html.match(/__cultureInfo = {"name":"(.*?)","/);

    // If no match is found, throw an error
    if (locale === null) throw new Error('Failed to match the locale');

    // Match the locale to the enum value
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

    // If we got here, something went wrong
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
        'Europe/Helsinki' // Tarjouspalvelu.fi always returns time in Helsinki time
    );
};

/**
 * Fetch an image from the given URL, and convert it to Base64
 *
 * @param url - The URL of the image to be fetched
 *
 * @returns Base64 representation of the image
 */
export const fetchImage = async (url: string): Promise<string> => {
     // Get the image from the URL as an array buffer
    const img = await axios.get(url, { responseType: 'arraybuffer' } );

    // Convert the array buffer to base64
    return Buffer.from(img.data, 'binary').toString('base64');
};

/**
 * Resolve a Tarjouspalvelu.fi global UUID (usually tpk or tpg)
 *
 * @param slug          - The slug of the company from the notice. An incorrect one will cause an error.
 * @param uuid          - The UUID of the notice to get
 * @param getFullNotice - Whether to get the full notice or only the identification details for it. Defaults to true.
 *
 * @returns The full notice or identification details for the notice
 */
/* export const resolveGlobalUuid = async (
    slug: string,
    uuid: string,
    getFullNotice = true
): Promise<Notice | NoticeIdentification> => {
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
}; */
