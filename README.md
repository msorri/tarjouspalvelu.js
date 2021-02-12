# Tarjouspalvelu.js

A Node.js scraper for the Finnish public procurement service, [tarjouspalvelu.fi.](https://tarjouspalvelu.fi/) 

Does not work in browsers due to Tarjouspalvelu.fi not having CORS headers.


## Usage

Install with `yarn add tarjouspalvelu.js`.

You need a Tarjouspalvelu.fi user to get a specific notice. The registration does not require any kind of verification.

**Note!** One company, the [Hanki Service](https://www.hanki-palvelu.fi/en/), is missing from the company list on the front page, so you may want to have a routine for handling it. The slug for it is `hanki`, and the ID is `279`.

### About the different IDs

Because of the scraping nature of this module, the company IDs used in the functions are designed to consume the least amount of requests, and resolving slugs to IDs consumes one. 

This means that slugs and numeric IDs are used quite wildly depending on the requirements of the function, and thus the implementing application should have its own dictionary of the company slugs and IDs. Keeping it up to date can be accomplished with the `getCompanies` function.


## Documentation

Documentation can be found at [https://msorri.github.io/tarjouspalvelu.js.](https://msorri.github.io/tarjouspalvelu.js)

The docs are generated with [TypeDoc](https://typedoc.org/), so if contributing have this installed.


## Roadmap

- Get a specific dynamic purchasing system
- Supplier registers
- Logic to filter contract notices from contract award notices, and add additional fields applicable only to them
- Deleting the tenders made by requesting the details from them
