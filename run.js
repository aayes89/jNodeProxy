const express = require('express');
const request = require('request');
const cheerio = require('cheerio');
const url = require('url');
const querystring = require('querystring');
const app = express();
const port = 8080;

app.use(express.static('public'));

app.get('/', (req, res) => {
  const query = querystring.stringify({
    includeJs: req.query.includeJs || '',
    includeImages: req.query.includeImages || '',
    includeCss: req.query.includeCss || ''
  });
  const proxyUrl = `/proxy?${query}`;
  const fullProxyUrl = `${proxyUrl}&url=${encodeURIComponent(req.query.url || '')}`;

  res.send(`
    <div style="background-color: #f2f2f2; padding: 10px;">
      <h1>Proxy Web</h1>
      <form method="get" action="${proxyUrl}">
        <label for="url">URL:</label>
        <input type="text" id="url" name="url" value="${req.query.url || ''}">
        <label for="includeJs">Incluir JS:</label>
        <input type="checkbox" id="includeJs" name="includeJs" ${req.query.includeJs ? 'checked' : ''}>
        <label for="includeImages">Incluir Imágenes:</label>
        <input type="checkbox" id="includeImages" name="includeImages" ${req.query.includeImages ? 'checked' : ''}>
        <label for="includeCss">Incluir CSS:</label>
        <input type="checkbox" id="includeCss" name="includeCss" ${req.query.includeCss ? 'checked' : ''}>
        <button type="submit">Cargar</button>
      </form>
    </div>
    <div style="margin-top: 20px;">
      <iframe src="${fullProxyUrl}" frameborder="0" style="width: 100%; height: calc(100vh - 120px);"></iframe>
    </div>
  `);
});

app.get('/proxy', (req, res) => {
  const requestedUrl = req.query.url;
  if (!requestedUrl || !Array.isArray(requestedUrl) && typeof requestedUrl !== 'string') {
    res.send('Por favor, proporciona una URL válida.');
    return;
  }

  const urlStr = Array.isArray(requestedUrl) ? requestedUrl[0] : requestedUrl;
  const parsedUrl = url.parse(urlStr, true);

  const searchPath = parsedUrl.path;
  const searchUrl = parsedUrl.protocol + '//' + parsedUrl.host + searchPath;

  const query = querystring.stringify(req.query);
  const proxyUrl = searchUrl + '?' + query;

  request(proxyUrl, (error, response, body) => {
    if (error) {
      res.send(`Error al cargar la página: ${error.message}`);
      return;
    }

    const $ = cheerio.load(body);

    // Reescribir las URL de los enlaces y recursos en la página
    $('a').each((index, element) => {
      const href = $(element).attr('href');
      if (href && !url.parse(href).host) {
        const absoluteUrl = url.resolve(searchUrl, href);
        const proxyHref = `/proxy?url=${encodeURIComponent(absoluteUrl)}&${query}`;
        $(element).attr('href', proxyHref);
      }
    });

    $('img, script, link[rel="stylesheet"]').each((index, element) => {
      const src = $(element).attr('src') || $(element).attr('href');
      if (src && !url.parse(src).host) {
        const absoluteUrl = url.resolve(searchUrl, src);
        const proxySrc = `/proxy?url=${encodeURIComponent(absoluteUrl)}&${query}`;
        $(element).attr('src', proxySrc);
        $(element).attr('href', proxySrc);
      }
    });

    res.send($.html());
  });
});

app.listen(port, () => {
  console.log(`Servidor proxy iniciado en el puerto ${port}`);
});
