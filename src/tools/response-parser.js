const TrunkedBodyParser = require('./trunked-body-parser.js');

class ResponseParser {
    constructor() { 
        this.STATUS_LINE = 0;
		this.STATUS_LINE_END = 1;
		this.HEADER_NAME = 2;
		this.HEADER_SPACE = 3;
		this.HEADER_VALUE = 4;
		this.HEADER_LINE_END = 5;
		this.HEADER_BLOCK_END = 6;
		this.BODY = 7;

		this.current = this.STATUS_LINE;
		this.statusLine = '';
		this.headers = {};
		this.headerName = '';
		this.headerValue = '';
		this.bodyParser = null;
    }

    get isFinished() {
		return this.bodyParser && this.bodyParser.isFinished;
	}
	get response() {
		this.statusLine.match(/HTTP\/1\.1 ([0-9]+) ([\s\S]+)/)
		return {
			statusCode: RegExp.$1,
			statusText: RegExp.$2,
			headers: this.headers,
			body: this.bodyParser.content.join(''),
		}
	}
    
    receive(string) {
        for (let i = 0; i < string.length; i++) {
            this.receiveChar(string.charAt(i));
        }
    }

    /**
     * use finite-state-machine to read the response
     * @param {string} char 
     */
    receiveChar(char) {
        if (this.current === this.STATUS_LINE) {
			if (char === '\r') {
				this.current = this.STATUS_LINE_END
			} else {
				this.statusLine += char;
			}
		} else if (this.current === this.STATUS_LINE_END) {
			if (char === '\n') {
				this.current = this.HEADER_NAME;
			}
		} else if (this.current === this.HEADER_NAME) {
			if (char === ':') {
				this.current = this.HEADER_SPACE;
			} else if (char === '\r') {
                this.current = this.HEADER_BLOCK_END;
                if (this.headers['Transfer-Encoding'] === 'chunked') {
					this.bodyParser = new TrunkedBodyParser();
				}
			} else {
				this.headerName += char;
			}
		} else if (this.current === this.HEADER_SPACE) {
			if (char === ' ') {
				this.current = this.HEADER_VALUE;
			}
		} else if (this.current === this.HEADER_VALUE) {
			if (char === '\r') {
				this.current = this.HEADER_LINE_END;
				this.headers[this.headerName] = this.headerValue;
				this.headerName = '';
				this.headerValue = '';
			} else {
				this.headerValue += char;
			}
		} else if (this.current === this.HEADER_LINE_END) {
			if (char === '\n') {
				this.current = this.HEADER_NAME;
			}
		} else if (this.current === this.HEADER_BLOCK_END) {
			if (char === '\n') {
				this.current = this.BODY;
			}
		} else if (this.current === this.BODY) {
            this.bodyParser.receiveChar(char);
		}
    }
}

module.exports = ResponseParser;