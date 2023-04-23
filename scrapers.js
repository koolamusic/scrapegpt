const cheerio = require('cheerio');
const axios = require('axios');
const OpenAiCall = require('./apicall');
const PreprocessorError = require('./errors').PreprocessorError;
const Response = require('./responses').Response;
const ScrapeResponse = require('./responses').ScrapeResponse;
const CleanHTML = require('./preprocessors').CleanHTML;
const JSONPostprocessor = require('./postprocessors').JSONPostprocessor;
const PydanticPostprocessor = require('./postprocessors').PydanticPostprocessor;
const utils = require('./utils');

class SchemaScraper extends OpenAiCall {
  static _default_preprocessors = [new CleanHTML()];

  constructor(
    schema,
    extra_preprocessors = null,
    auto_split_length = 0,
    extra_instructions = null,
    postprocessors = null,
    ...kwargs
  ) {
    super(kwargs);
    let use_pydantic = false;
    if (Array.isArray(schema) || typeof schema === 'object') {
      this.json_schema = JSON.stringify(schema);
    } else if (typeof schema === 'string') {
      this.json_schema = schema;
    } else if (schema.hasOwnProperty('schema')) {
      this.json_schema = _pydantic_to_simple_schema(schema);
      use_pydantic = true;
    } else {
      throw new ValueError(`Invalid schema: ${schema}`);
    }

    let _default_postprocessors;
    let json_type;
    if (auto_split_length) {
      json_type = 'list of JSON objects';
      _default_postprocessors = [new JSONPostprocessor({ nudge: false })];
    } else {
      json_type = 'JSON object';
      _default_postprocessors = [new JSONPostprocessor({ nudge: true })];
    }

    this.postprocessors = postprocessors || _default_postprocessors;
    this.system_messages = [
      `For the given HTML, convert to a ${json_type} matching this schema: ${this.json_schema}`,
      'Responses should be valid JSON, with no other text. Never truncate the JSON with an ellipsis. Always use double quotes for strings and escape quotes with \\. Always omit trailing commas.',
    ];

    if (extra_instructions) {
      this.system_messages.push(...extra_instructions);
    }

    this.preprocessors = extra_preprocessors
      ? [...SchemaScraper._default_preprocessors, ...extra_preprocessors]
      : SchemaScraper._default_preprocessors;

    if (use_pydantic) {
      this.postprocessors.push(new PydanticPostprocessor(schema));
    }

    this.auto_split_length = auto_split_length;
  }

  // Add remaining methods
  _apply_preprocessors(doc, extra_preprocessors) {
    let nodes = [doc];
  
    // apply preprocessors one at a time
    for (const p of [...this.preprocessors, ...extra_preprocessors]) {
      let new_nodes = [];
      for (const node of nodes) {
        new_nodes.push(...p(node));
      }
      utils.logger.debug(
        'preprocessor',
        { name: String(p), from_nodes: nodes.length, nodes: new_nodes.length }
      );
      if (!new_nodes.length) {
        throw new PreprocessorError(`Preprocessor ${p} returned no nodes for ${nodes}`);
      }
      nodes = new_nodes;
    }
  
    return nodes;
  }
  
  scrape(url_or_html, extra_preprocessors = null) {
    let sr = new ScrapeResponse();
  
    sr.url = url_or_html.startsWith('http') ? url_or_html : null;
    // obtain an HTML document from the URL or HTML string
    sr.parsed_html = utils._parse_url_or_html(url_or_html);
  
    // apply preprocessors, returning a list of tags
    const tags = this._apply_preprocessors(sr.parsed_html, extra_preprocessors || []);
  
    sr.auto_split_length = this.auto_split_length;
    if (this.auto_split_length) {
      // if auto_split_length is set, split the tags into chunks and then recombine
      const chunks = utils._chunk_tags(tags, this.auto_split_length, { model: this.models[0] });
      // Note: this will not work when the postprocessor is expecting
      // ScrapedResponse (like HallucinationChecker)
      const all_responses = chunks.map(chunk => this.request(chunk));
      return utils._combine_responses(sr, all_responses);
    } else {
      // otherwise, scrape the whole document as one chunk
      const html = tags.map(t => utils._tostr(t)).join('\n');
      // apply postprocessors to the ScrapeResponse
      // so that they can access the parsed HTML if needed
      return this._apply_postprocessors(  // type: ignore
        utils._combine_responses(sr, [this._api_request(html)])
      );
    }
  }
  
  // allow the class to be called like a function
  __call__ = this.scrape;

  function _combine_responses(sr, responses) {
    sr.api_responses = responses.flatMap(resp => resp.api_responses);
    sr.total_cost = responses.reduce((acc, resp) => acc + resp.total_cost, 0);
    sr.total_prompt_tokens = responses.reduce((acc, resp) => acc + resp.total_prompt_tokens, 0);
    sr.total_completion_tokens = responses.reduce((acc, resp) => acc + resp.total_completion_tokens, 0);
    sr.api_time = responses.reduce((acc, resp) => acc + resp.api_time, 0);
    sr.data = responses.length > 1 ? responses.flatMap(resp => resp.data) : responses[0].data;
    return sr;
  }
  
  async function _parse_url_or_html(url_or_html) {
    let orig_url = null;
    if (url_or_html.startsWith("http")) {
      orig_url = url_or_html;
      url_or_html = (await axios.get(url_or_html)).data;
    }
    url_or_html = url_or_html.replace(/[ \t]+/g, " ");
    utils.logger.debug("got HTML", { length: url_or_html.length, url: orig_url });
    const doc = new JSDOM(url_or_html).window.document;
    if (orig_url) {
      utils.make_links_absolute(doc, orig_url);
    }
    return doc.documentElement;
  }
  
  function _chunk_tags(tags, max_tokens, model) {
    const chunks = [];
    const chunk_sizes = [];
    let chunk = "";
    let chunk_tokens = 0;
    for (const tag of tags) {
      const tag_html = utils._tostr(tag);
      const tag_tokens = utils._tokens(model, tag_html);
      if (chunk_tokens + tag_tokens > max_tokens && chunk_tokens > 0) {
        chunks.push(chunk);
        chunk_sizes.push(chunk_tokens);
        chunk = "";
        chunk_tokens = 0;
      }
      chunk += tag_html;
      chunk_tokens += tag_tokens;
    }
  
    chunks.push(chunk);
    chunk_sizes.push(chunk_tokens);
    utils.logger.debug("chunked tags", { num: chunks.length, sizes: chunk_sizes });
    return chunks;
  }
  
  function _pydantic_to_simple_schema(pydantic_model) {
    const schema = {};
    for (const field of Object.values(pydantic_model.__fields__)) {
      if (field.outer_type_.__fields__) {
        schema[field.name] = _pydantic_to_simple_schema(field.outer_type_);
      } else {
        let type_name = field.outer_type_.__name__;
        if (type_name === "list") {
          type_name += `[${field.type_.__name__}]`;
        }
        schema[field.name] = type_name;
      }
    }
    return schema;
  }
  
}

module.exports = SchemaScraper;
