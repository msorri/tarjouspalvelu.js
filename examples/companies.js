const tp = require('tarjouspalvelu.js');

const run = async () => {
    const companies = await tp.getCompanies(false); // Get the list of companies

    companies.forEach((e, i) => {
        console.log(
            `${i + 1} / ${companies.length} - ${e.slug} - ${e.name}` // Get a nice listing out of the list
        );
    });
}

run();
