const net = require('net');
const images = require('images');
const htmlParser = require('./tools/html-parser.js');
const render = require('./tools/render.js');

class Resquest {
    constructor(options) {
        this.method = options.method || 'GET';
        this.host = options.host;
        this.port = options.port || 80;
        this.path = options.path || '/';
        this.body = options.body || {};
        this.header = options.header || {};
        if (!this.header['Content-Type']) {
            this.header['Content-Type'] = "application/json";
        }

        if (this.header['Content-Type'] === 'application/json') {
            this.bodyText = JSON.stringify(this.body);
        }

        if (this.header['Content-Type'] === 'application/x-www-form-urlencoded') {
            this.bodyText = Object.keys(this.body)
                .map(key => `${key}=${encodeURIComponent(this.body[key])}`)
                .join('&');
        }

        this.header['Content-Length'] = this.bodyText.length;
    }

    toString() {
        return `${this.method} ${this.path} HTTP/1.1\r\n${Object.keys(this.header)
            .map(key => `${key}: ${this.header[key]}`)
            .join('\r\n')}\r\n\r\n${this.bodyText}`;
    }

    send(connection) {
        return new Promise((resolve, reject) => {
			const parser = new ResponseParser();
            if (connection) {
                connection.write(this.toString());
            } else {
                // create TCP connection
                connection = net.createConnection({
                    host: this.host,
                    port: this.port
                }, () => {
                    connection.write(this.toString());
                });
            }
            connection.on('data', (data) => {
                parser.receive(data.toString());
                if (parser.isFinished) {
                    resolve(parser.response);
                    connection.end();
                }
            });
            connection.on('error', (error) => {
				console.log(error),
                reject(error);
                connection.end();
            })
        });
    }
}

class ResponseParser {
    constructor() { 
        this.WAITING_STATUS_LINE = 0
		this.WAITING_STATUS_LINE_END = 1
		this.WAITING_HEADER_NAME = 2
		this.WAITING_HEADER_SPACE = 3
		this.WAITING_HEADER_VALUE = 4
		this.WAITING_HEADER_LINE_END = 5
		this.WAITING_HEADER_BLOCK_END = 6
		this.WAITING_BODY = 7

		this.current = this.WAITING_STATUS_LINE
		this.statusLine = ''
		this.headers = {}
		this.headerName = ''
		this.headerValue = ''
		this.bodyParser = null
    }

    get isFinished() {
		return this.bodyParser && this.bodyParser.isFinished
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
        if (this.current === this.WAITING_STATUS_LINE) {
			if (char === '\r') {
				this.current = this.WAITING_STATUS_LINE_END
			} else {
				this.statusLine += char
			}
		} else if (this.current === this.WAITING_STATUS_LINE_END) {
			if (char === '\n') {
				this.current = this.WAITING_HEADER_NAME
			}
		} else if (this.current === this.WAITING_HEADER_NAME) {
			if (char === ':') {
				this.current = this.WAITING_HEADER_SPACE
			} else if (char === '\r') {
                this.current = this.WAITING_HEADER_BLOCK_END
                if (this.headers['Transfer-Encoding'] === 'chunked') {
					this.bodyParser = new TrunkedBodyParser()
				}
			} else {
				this.headerName += char
			}
		} else if (this.current === this.WAITING_HEADER_SPACE) {
			if (char === ' ') {
				this.current = this.WAITING_HEADER_VALUE
			}
		} else if (this.current === this.WAITING_HEADER_VALUE) {
			if (char === '\r') {
				this.current = this.WAITING_HEADER_LINE_END
				this.headers[this.headerName] = this.headerValue
				this.headerName = ''
				this.headerValue = ''
			} else {
				this.headerValue += char
			}
		} else if (this.current === this.WAITING_HEADER_LINE_END) {
			if (char === '\n') {
				this.current = this.WAITING_HEADER_NAME
			}
		} else if (this.current === this.WAITING_HEADER_BLOCK_END) {
			if (char === '\n') {
				this.current = this.WAITING_BODY
			}
		} else if (this.current === this.WAITING_BODY) {
            this.bodyParser.receiveChar(char);
		}
    }
}

class TrunkedBodyParser {
	constructor() {
		this.WAITING_LENGTH = 0
		this.WAITING_LENGTH_END = 1
		this.READING_TRUNK = 2
		this.WAITING_NEW_LINE = 3
		this.WAITING_NEW_LINE_END = 4

		this.current = this.WAITING_LENGTH
		this.length = 0
		this.content = []
		this.isFinished = false
	}
	receiveChar(char) {
		if (this.current === this.WAITING_LENGTH) {
			if (char === '\r') {
				if (this.length === 0) {
					this.isFinished = true
					this.current = this.WAITING_NEW_LINE
				} else {
					this.current = this.WAITING_LENGTH_END
				}
			} else {
				this.length *= 16
				this.length += parseInt(char, 16)
			}
		} else if (this.current === this.WAITING_LENGTH_END) {
			if (char === '\n') {
				this.current = this.READING_TRUNK
			}
		} else if (this.current === this.READING_TRUNK) {
			this.content.push(char)
			this.length--
			if (this.length === 0) {
				this.current = this.WAITING_NEW_LINE
			}
		} else if (this.current === this.WAITING_NEW_LINE) {
			if (char === '\r') {
				this.current = this.WAITING_NEW_LINE_END
			}
		} else if (this.current === this.WAITING_NEW_LINE_END) {
			if (char === '\n') {
				this.current = this.WAITING_LENGTH
			}
		}
	}
}

void async function (){
    let req = new Resquest({
        method: "POST",
        host: "127.0.0.1",
        port: 8088,
        path: "/",
        haeder: {
            foo: 'test' 
        },
        body: {
            name: 'test'
        }
    });

	let res = await req.send();
	
	let dom = htmlParser.parseHTML(res.body);
	dom.style = {};

	console.log(JSON.stringify(dom));

	let viewport = images(800, 600);
	render(viewport, dom);
	viewport.save('../dist/viewport.jpg');
}()