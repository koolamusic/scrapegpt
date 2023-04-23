class ScrapeghostError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScrapeghostError';
  }
}

class TooManyTokens extends ScrapeghostError {
  constructor(message) {
    super(message);
    this.name = 'TooManyTokens';
  }
}

class MaxCostExceeded extends ScrapeghostError {
  constructor(message) {
    super(message);
    this.name = 'MaxCostExceeded';
  }
}

class PreprocessorError extends ScrapeghostError {
  constructor(message) {
    super(message);
    this.name = 'PreprocessorError';
  }
}

class BadStop extends ScrapeghostError {
  constructor(message) {
    super(message);
    this.name = 'BadStop';
  }
}

class InvalidJSON extends ScrapeghostError {
  constructor(message) {
    super(message);
    this.name = 'InvalidJSON';
  }
}

class PostprocessingError extends ScrapeghostError {
  constructor(message) {
    super(message);
    this.name = 'PostprocessingError';
  }
}

module.exports = {
  ScrapeghostError,
  TooManyTokens,
  MaxCostExceeded,
  PreprocessorError,
  BadStop,
  InvalidJSON,
  PostprocessingError
};
