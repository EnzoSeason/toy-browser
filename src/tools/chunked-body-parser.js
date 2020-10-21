class ChunkedBodyParser {
	constructor() {
		this.LENGTH = 0;
		this.LENGTH_END = 1;
		this.READING_TRUNK = 2;
		this.NEW_LINE = 3;
		this.NEW_LINE_END = 4;

		this.current = this.LENGTH;
		this.length = 0;
		this.content = [];
		this.isFinished = false;
	}
	receiveChar(char) {
		if (this.current === this.LENGTH) {
			if (char === '\r') {
				if (this.length === 0) {
					this.isFinished = true;
					this.current = this.NEW_LINE;
				} else {
					this.current = this.LENGTH_END;
				}
			} else {
				this.length *= 16;
				this.length += parseInt(char, 16);
			}
		} else if (this.current === this.LENGTH_END) {
			if (char === '\n') {
				this.current = this.READING_TRUNK;
			}
		} else if (this.current === this.READING_TRUNK) {
			this.content.push(char);
			this.length--;
			if (this.length === 0) {
				this.current = this.NEW_LINE;
			}
		} else if (this.current === this.NEW_LINE) {
			if (char === '\r') {
				this.current = this.NEW_LINE_END;
			}
		} else if (this.current === this.NEW_LINE_END) {
			if (char === '\n') {
				this.current = this.LENGTH;
			}
		}
	}
}

module.exports = ChunkedBodyParser;