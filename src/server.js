const http = require('http');
const fs = require('fs');

http.createServer((req, res) => {
    req.on('error', err => {
        console.log(err);
    }).on('data', (_) => {

    }).on('end', () => {
        fs.readFile(
            './index.html', 
            (err, data) => {
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.write(data);
                return res.end();
            });
    });
}).listen(8088);

console.log("server start");