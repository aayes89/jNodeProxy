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
  const proxyUrl = `/proxy?url=${encodeURIComponent(req.query.url || '')}&${query}`;

  const includeJsChecked = req.query.includeJs ? 'checked' : '';
  const includeImagesChecked = req.query.includeImages ? 'checked' : '';
  const includeCssChecked = req.query.includeCss ? 'checked' : '';

  res.send(`
    <div style="background-color: #f2f2f2; padding: 10px;">
      <form id="proxyForm" method="get" action="/">
        <label for="url">URL:</label>
        <input type="text" id="url" name="url" value="${req.query.url || ''}">
        <label for="includeJs">Incluir JS:</label>
        <input type="checkbox" id="includeJs" name="includeJs" ${includeJsChecked}>
        <label for="includeImages">Incluir Imágenes:</label>
        <input type="checkbox" id="includeImages" name="includeImages" ${includeImagesChecked}>
        <label for="includeCss">Incluir CSS:</label>
        <input type="checkbox" id="includeCss" name="includeCss" ${includeCssChecked}>
        <button type="submit">Cargar</button>
      </form>
    </div>
    <div style="margin-top: 20px;">
      <iframe id="proxyFrame" src="${proxyUrl}" frameborder="0" style="width: 100%; height: calc(100vh - 120px);"></iframe>
    </div>
    <script>
      const proxyForm = document.getElementById('proxyForm');
      const proxyFrame = document.getElementById('proxyFrame');

      proxyForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const urlInput = document.getElementById('url');
        const newUrl = encodeURIComponent(urlInput.value);
        const query = new URLSearchParams({
          includeJs: document.getElementById('includeJs').checked ? 'on' : '',
          includeImages: document.getElementById('includeImages').checked ? 'on' : '',
          includeCss: document.getElementById('includeCss').checked ? 'on' : ''
        }).toString();
        const newProxyUrl = '/proxy?url=' + newUrl + '&' + query;
        proxyFrame.src = newProxyUrl;
      });
    </script>
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
        const proxyHref = '/proxy?url=' + encodeURIComponent(absoluteUrl) + '&' + query;
        $(element).attr('href', proxyHref);
      }
    });

    if (req.query.includeImages) {
      $('img').each((index, element) => {
        const src = $(element).attr('src');
        if (src && !url.parse(src).host) {
          const absoluteUrl = url.resolve(searchUrl, src);
          const proxySrc = '/proxy?url=' + encodeURIComponent(absoluteUrl) + '&' + query;
          $(element).attr('src', proxySrc);
        }
      });
    } else {
      $('img').remove();
    }

    if (req.query.includeJs) {
      $('script').each((index, element) => {
        const src = $(element).attr('src');
        if (src && !url.parse(src).host) {
          const absoluteUrl = url.resolve(searchUrl, src);
          const proxySrc = '/proxy?url=' + encodeURIComponent(absoluteUrl) + '&' + query;
          $(element).attr('src', proxySrc);
        }
      });
    } else {
      $('script').remove();
    }

    if (req.query.includeCss) {
      $('link[rel="stylesheet"]').each((index, element) => {
        const href = $(element).attr('href');
        if (href && !url.parse(href).host) {
          const absoluteUrl = url.resolve(searchUrl, href);
          const proxyHref = '/proxy?url=' + encodeURIComponent(absoluteUrl) + '&' + query;
          $(element).attr('href', proxyHref);
        }
      });
    } else {
      $('link[rel="stylesheet"]').remove();
    }

    res.send($.html());
  });
});

app.listen(port, () => {
  console.log(`Servidor proxy iniciado en el puerto ${port}`);
});
