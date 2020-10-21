const net = require('net');
const images = require('images');
const ResponseParser = require('./tools/response-parser.js');
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
				const responseParser = new ResponseParser();
                responseParser.receive(data.toString());
                if (responseParser.isFinished) {
                    resolve(responseParser.response);
                    connection.end();
                }
            });
            connection.on('error', (error) => {
                reject(error);
                connection.end();
            })
        });
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