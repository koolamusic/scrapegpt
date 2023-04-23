export class Response {
  constructor() {
    this.api_responses = [];
    this.total_cost = 0;
    this.total_prompt_tokens = 0;
    this.total_completion_tokens = 0;
    this.api_time = 0;
    this.data = '';
  }
}

export class ScrapeResponse extends Response {
  constructor() {
    super();
    this.url = null;
    this.parsed_html = null;
    this.auto_split_length = null;
  }
}
