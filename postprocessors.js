const { ValidationError } = require('class-validator');
const { logger, toStr } = require('./utils');
const { InvalidJSON, PostprocessingError } = require('./errors');
const { Response, ScrapeResponse } = require('./responses');

export class JSONPostprocessor {
  constructor(nudge = true) {
    this.nudge = nudge;
  }

  toString() {
    return `JSONPostprocessor(nudge=${this.nudge})`;
  }

  async call(response, scraper) {
    if (typeof response.data !== 'string') {
      throw new PostprocessingError(`Response data is not a string: ${response.data}`);
    }

    try {
      response.data = JSON.parse(response.data);
    } catch (error) {
      if (scraper.scrape && this.nudge) {
        // call nudge and try again
        response = await this.nudgeJson(scraper, response);
        if (typeof response.data !== 'string') {
          throw new PostprocessingError(`Response data is not a string: ${response.data}`);
        }
        try {
          response.data = JSON.parse(response.data);
        } catch (error) {
          // if still invalid, raise error
          throw new InvalidJSON(response.data);
        }
      } else {
        throw new InvalidJSON(response.data);
      }
    }
    return response;
  }

  async nudgeJson(scraper, response) {
    // implement scraper._raw_api_request method
  }
}

export class ValidatorPostprocessor {
  constructor(model) {
    this.pydanticModel = model;
  }

  toString() {
    return `ValidatorPostprocessor(${this.pydanticModel})`;
  }

  async call(response, scraper) {
    if (typeof response.data !== 'object') {
      throw new PostprocessingError(
        'ValidatorPostprocessor expecting a dict, ensure JSONPostprocessor or equivalent is used first.'
      );
    }
    try {
      // Use class-validator or another validation library to validate and transform the data
    } catch (e) {
      logger.error('validation error', { error: e, data: response.data });
      throw e;
    }

    return response;
  }
}

export class HallucinationChecker {
  toString() {
    return 'HallucinationChecker';
  }

  async call(response, scraper) {
    if (!(response instanceof ScrapeResponse)) {
      throw new PostprocessingError(
        'HallucinationChecker expects ScrapeResponse, Incompatible with auto_split_length'
      );
    }
    const html = toStr(response.parsedHtml);

    checkDataInHtml(html, response.data);

    return response;
  }
}

function checkDataInHtml(html, d, parent = '') {
  if (typeof d === 'object' && !Array.isArray(d)) {
    for (const [k, v] of Object.entries(d)) {
      checkDataInHtml(html, v, `${parent}.${k}`);
    }
  } else if (Array.isArray(d)) {
    d.forEach((v, i) => {
      checkDataInHtml(html, v, `${parent}[${i}]`);
    });
  } else if (typeof d === 'string') {
    if (!html.includes(d)) {
      throw new PostprocessingError(`Data not found in html: ${d} (${parent})`);
    }
  }
}
