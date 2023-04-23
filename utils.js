const cheerio = require('cheerio');
const structlog = require('structlog');
const { Tokenizer, encodingForModel } = require('@dqbd/tiktoken');

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'openai-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export function _tostr(obj) {
  return obj.html();
}

function _cost(model, promptTokens, completionTokens) {
  const [ptCost, ctCost] = {
    'gpt-4': [0.03, 0.06],
    'gpt-3.5-turbo': [0.002, 0.002],
  }[model];
  return (promptTokens / 1000) * ptCost + (completionTokens / 1000) * ctCost;
}

export function _tokens(model, html) {
  const encoding = encodingForModel(model);
  const tokenizer = new Tokenizer(encoding);
  return tokenizer.encode(html).length;
}

export function _maxTokens(model) {
  return {
    'gpt-4': 8192,
    'gpt-3.5-turbo': 4096,
  }[model];
}

export function costEstimate(html, model = 'gpt-4') {
  const tokens = _tokens(model, html);
  return _cost(model, tokens, tokens);
}
