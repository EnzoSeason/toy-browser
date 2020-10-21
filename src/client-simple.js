const net = require('net');

class Resquest {
    constructor(options) {
        this.method = options.method || 'GET';
        this.host = options.host;
        this.port = options.port || 80;
        this.path = options.path || '/';
        this.body = options.body || {};
        this.header = options.header || {};
        this.header['Content-Type'] = "application/json";
        this.bodyText = JSON.stringify(this.body);
        this.header['Content-Length'] = this.bodyText.length;
    }

    toString() {
        return `${this.method} ${this.path} HTTP/1.1\r\n${Object.keys(this.header)
            .map(key => `${key}: ${this.header[key]}`)
            .join('\r\n')}\r\n\r\n${this.bodyText}`;
    }

    send(connection) {
        return new Promise((resolve, reject) => {
            console.log(this.toString());
            console.log('\n');
            
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
                resolve(data.toString());
                connection.end();
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
        method: "GET",
        host: "127.0.0.1",
        port: 8088,
        path: "/",
        body: {
            name: 'test'
        }
    });

    let res = await req.send();
    console.log(res);
}()