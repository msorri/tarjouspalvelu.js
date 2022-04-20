import {
    companySlugToId,
    getCompanyProcurementOrganizationId,
    getSession,
    getSessionLanguage,
    Language,
    loginToSession,
    setSessionLanguage,
} from '../src';

test('slug "helsinki" should convert to numeric ID 13', async () => {
    expect(await companySlugToId('helsinki')).toStrictEqual(13);
});

test('slug "helsinkii" should throw an error', async () => {
    await expect(companySlugToId('helsinkii')).rejects.toThrow();
});

test('gotten session should be able to perform a function requiring it', async () => {
    const session = await getSession('helsinki');
    expect(
        await getCompanyProcurementOrganizationId(13, session)
    ).toStrictEqual(14);
});

test('getting a session with an invalid slug should fail', async () => {
    await expect(getSession('helsinkii')).rejects.toThrow();
});

test('logging in to a session with an invalid session should fail', async () => {
    await expect(
        loginToSession(13, '', '', {
            uuid: 'invalid',
            id: 'invalid',
        })
    ).rejects.toThrow('Failed to load index page, bad session?');
});

test('logging in to a session with invalid credentials should fail', async () => {
    await expect(
        loginToSession(13, 'invalid', 'invalid', await getSession('helsinki'))
    ).rejects.toThrow('Failed to log in, bad username/password?');
});

test('setting a session language should result in the correct language to be set', async () => {
    const session = await getSession('helsinki');

    // swedish language is never gotten without explicitly setting it
    await setSessionLanguage(13, Language.Sv, session);
    expect(await getSessionLanguage(13, session)).toStrictEqual(Language.Sv);
});

test('setting a session language with an invalid session should fail', async () => {
    await expect(
        setSessionLanguage(13, Language.Sv, {
            uuid: 'invalid',
            id: 'invalid',
        })
    ).rejects.toThrow('Failed to load index page, bad session?');
});
