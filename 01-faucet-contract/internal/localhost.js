/* INTERNAL

The code below is for making an HTTP POST request and has little to do with Pact
or Chainweb directly. Read it if you'd like, but you can safely ignore it, too.
*/
const http = require("http");

exports.post = ({ path, body }) => {
  return new Promise((resolve, reject) => {
    const options = {
      host: "localhost",
      port: "8080",
      method: "POST",
      path,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (data) => {
        chunks.push(data);
      });
      res.on("end", () => {
        let result = Buffer.concat(chunks).toString();
        if (result.startsWith("<html>")) {
          reject(
            "Received connection timeout. You may need to restart devnet or try this request again."
          );
        } else {
          if (result.includes("Validation failed for hash")) {
            console.log(result);
            reject(result);
          } else {
            try {
              const parsed = JSON.parse(result);
              resolve(parsed);
            } catch (err) {
              console.log(`Failed to parse JSON response: ${err}`);
              reject(err);
            }
          }
        }
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
};
