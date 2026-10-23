export class LangError extends Error {
  constructor(message, line = 1, col = 1) {
    super(message);
    this.name = 'LangError';
    this.line = line;
    this.col = col;
  }

  toString() {
    return `${this.name}: ${this.message} (line ${this.line}, column ${this.col})`;
  }
}
