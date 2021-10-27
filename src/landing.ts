import fs from "fs";
import showdown from "showdown";

const converter = new showdown.Converter();
const readmeHTML = converter.makeHtml(
  fs.readFileSync(__dirname + "/../README.md", "utf-8")
);

export const landingPageHTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>SPL Token Aggregator</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css">
  </head>
  <body>
    <div class="container" class="mt-5">
      ${readmeHTML}
    </div>
  </body>
</html>
`;
