const tp = require('tarjouspalvelu.js');

const run = async () => {
    const session = await tp.getSession('helsinki'); // Create a new session

    tp.setSessionLanguage(13, 'en-GB', session); // Set the session language to en-GB

    const notices = await tp.getNotices(13, session); // Get the list of notices from Helsinki

    notices.notices.forEach((e, i) => {
        console.log(
            `${i + 1} / ${notices.notices.length} - ${e.id} - ${e.title}` // Get a nice listing out of the list
        );
    });
}

run();
