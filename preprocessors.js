const parse5 = require('parse5');
const { JSDOM } = require('jsdom');
const cssSelect = require('css-select');

class CleanHTML {
  constructor(options = {}) {
    this.options = options;
  }

  toString() {
    return 'CleanHTML';
  }

  apply(node) {
    const document = parse5.serialize(node);
    const dom = new JSDOM(document, this.options);
    return dom.window.document.documentElement;
  }
}

class XPath {
  constructor(xpath) {
    this.xpath = xpath;
  }

  toString() {
    return `XPath(${this.xpath})`;
  }

  apply(node) {
    const document = parse5.serialize(node);
    const dom = new JSDOM(document);
    const xpath = require('xpath');
    const select = xpath.useNamespaces({ html: 'http://www.w3.org/1999/xhtml' });
    return select(this.xpath, dom.window.document.documentElement);
  }
}

class CSS {
  constructor(css) {
    this.css = css;
  }

  toString() {
    return `CSS(${this.css})`;
  }

  apply(node) {
    const document = parse5.serialize(node);
    const dom = new JSDOM(document);
    return cssSelect(this.css, dom.window.document.documentElement);
  }
}

module.exports = {
  CleanHTML,
  XPath,
  CSS
};
