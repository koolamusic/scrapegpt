# Scrape GPT

Use GPT-4 to scrape any remote website based on a URL. This is a simple wrapper around the [OpenAI API](https://beta.openai.com/docs/api-reference/introduction) that allows you to scrape any website using GPT-4.

## Installation

```bash
npm i scrapegpt
```

## Usage

```js
const scrape = require('scrapegpt');

const url = 'https://www.bbc.com/news/world-us-canada-57982050';

scrape(url).then((result) => {
  console.log(result);
});
```

## Resources

- [OpenAI API](https://beta.openai.com/docs/api-reference/introduction)
- [Nodejs Scraping](https://gabrieleromanato.name/nodejs-parsing-a-remote-html-page)