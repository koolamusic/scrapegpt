const openai = require('openai');
const winston = require('winston');

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'openai-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export class RetryRule {
  constructor(maxRetries = 0, retryWait = 30, retryErrors = [openai.RateLimitError, openai.Timeout, openai.APIConnectionError]) {
    this.maxRetries = maxRetries;
    this.retryWait = retryWait;
    this.retryErrors = retryErrors;
  }
}

class OpenAiCall {
  constructor({
    models = ['gpt-3.5-turbo', 'gpt-4'],
    modelParams = {},
    maxCost = 1,
    extraInstructions = null,
    postprocessors = null,
    retry = new RetryRule(1, 30),
  }) {
    this.totalPromptTokens = 0;
    this.totalCompletionTokens = 0;
    this.totalCost = 0;
    this.maxCost = maxCost;
    this.models = models;
    this.retry = retry;
    this.modelParams = modelParams;

    if (!('temperature' in modelParams)) {
      modelParams.temperature = 0;
    }

    this.systemMessages = [];
    if (extraInstructions) {
      this.systemMessages.push(...extraInstructions);
    }

    if (postprocessors === null) {
      this.postprocessors = []; // default postprocessors
    } else {
      this.postprocessors = postprocessors;
    }
  }

  async _rawApiRequest(model, messages) {
    if (this.totalCost > this.maxCost) {
      throw new Error(`Total cost ${this.totalCost.toFixed(2)} exceeds max cost ${this.maxCost.toFixed(2)}`);
    }

    const start_t = Date.now();

    const completion = await openai.ChatCompletion.create({
      model,
      messages,
      ...this.modelParams,
    });

    const elapsed = (Date.now() - start_t) / 1000;
    const p_tokens = completion.usage.prompt_tokens;
    const c_tokens = completion.usage.completion_tokens;
    /* Calculate cost here based on your own logic */;
    const cost = _cost(model, p_tokens, c_tokens);

    logger.info({
      message: 'API response',
      duration: elapsed,
      prompt_tokens: p_tokens,
      completion_tokens: c_tokens,
      finish_reason: completion.choices[0].finish_reason,
      cost,
    });

    if (completion.choices[0].finish_reason !== 'stop') {
      throw new Error(`OpenAI did not stop: ${completion.choices[0].finish_reason} (prompt_tokens=${p_tokens}, completion_tokens=${c_tokens})`);
    }

    this.totalPromptTokens += p_tokens;
    this.totalCompletionTokens += c_tokens;
    this.totalCost += cost;

    return completion.choices[0].message.content;
  }

  async _apiRequest(html) {
    let attempts = 0;
    let model_index = 0;
    let model = this.models[model_index];

    const response = new Response();

    if (!html) {
      throw new Error('html parameter cannot be empty');
    }

    const tokens = _tokens(model, html);
    if (tokens > _maxTokens(model)) {
      throw new Error(
        `HTML is ${tokens} tokens, max for ${model} is ${_maxTokens(model)}`
      );
    }

    while (true) {
      try {
        attempts += 1;
        await this._rawApiRequest(
          model,
          [
            ...this.system_messages.map((msg) => ({
              role: 'system',
              content: msg,
            })),
            {
              role: 'user',
              content: html,
            },
          ],
          response
        );
        return response;
      } catch (e) {
        if (
          this.retry.retry_errors.includes(e.constructor) ||
          e.message.includes('TooManyTokens') ||
          e.message.includes('BadStop')
        ) {
          if (attempts < this.retry.max_retries + 1) {
            if (this.retry.retry_errors.includes(e.constructor)) {
              // try again with same model
              await new Promise((resolve) =>
                setTimeout(resolve, this.retry.retry_wait * 1000)
              );
              continue;
            } else if (model_index < this.models.length - 1) {
              // try next model
              model_index += 1;
              model = this.models[model_index];
              await new Promise((resolve) =>
                setTimeout(resolve, this.retry.retry_wait * 1000)
              );
              continue;
            }
          }
          throw e; // could not retry for whatever reason
        }
      }
    }
  }


  _applyPostprocessors(response) {
    for (const pp of this.postprocessors) {
      response = pp(response, this);
    }
    return response;
  }

  async request(html) {
    return this._apply_postprocessors(await this._apiRequest(html));
  }

  stats() {
    return {
      total_prompt_tokens: this.total_prompt_tokens,
      total_completion_tokens: this.total_completion_tokens,
      total_cost: this.total_cost,
    };
  }
}
