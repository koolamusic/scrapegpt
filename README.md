# Scrape GPT

Use GPT-4 to scrape any remote website based on a URL. This is a simple wrapper around the [OpenAI API](https://beta.openai.com/docs/api-reference/introduction) that allows you to scrape any website using GPT-4.

This codebase is GPT generated based of the [Scrapeghost.PY](https://github.com/jamesturk/scrapeghost) codebase.

## Installation

```bash
npm i scrapegpt
```

## Usage

**Use at your own risk. This library makes considerably expensive calls ($0.36 for a GPT-4 call on a moderately sized page.) Cost estimates are based on the [OpenAI pricing page](https://beta.openai.com/pricing) and not guaranteed to be accurate.**

```js
const scrape = require('scrapegpt');

const url = 'https://www.bbc.com/news/world-us-canada-57982050';

scrape(url).then((result) => {
  console.log(result);
});
```

## Features

The purpose of this library is to provide a convenient interface for exploring web scraping with GPT.

While the bulk of the work is done by the GPT model, `scrapegpt` provides a number of features to make it easier to use.

**JSON schema definition** - Define the shape of the data you want to extract as any JSON object, with as much or little detail as you want.

**Preprocessing**

* **HTML cleaning** - Remove unnecessary HTML to reduce the size and cost of API requests.
* **Auto-splitting** - Optionally split the HTML into multiple calls to the model, allowing for larger pages to be scraped.

**Postprocessing**

* **JSON validation** - Ensure that the response is valid JSON.  (With the option to kick it back to GPT for fixes if it's not.)
* **Hallucination check** - Does the data in the response truly exist on the page?

**Cost Controls**

* Scrapers keep running totals of how many tokens have been sent and received, so costs can be tracked.
* Support for automatic fallbacks (e.g. use cost-saving GPT-3.5-Turbo by default, fall back to GPT-4 if needed.)
* Allows setting a budget and stops the scraper if the budget is exceeded.


## Resources

- [OpenAI API](https://beta.openai.com/docs/api-reference/introduction)
- [Nodejs Scraping](https://gabrieleromanato.name/nodejs-parsing-a-remote-html-page)
- [Scrape HTML](https://www.npmjs.com/package/scrape-html)
- [Scrapeghost.PY](https://github.com/jamesturk/scrapeghost/)
- [Scrape It](https://www.npmjs.com/package/scrape-it-core)


## Ditto

Inspired by: [https://github.com/jamesturk/scrapeghost](https://github.com/jamesturk/scrapeghost)


