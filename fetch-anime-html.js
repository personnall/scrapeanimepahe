const url = 'https://animepahe.pw/anime/189046';
fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Referer: 'https://animepahe.pw/',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    Connection: 'keep-alive',
  },
})
  .then((res) => res.text())
  .then((text) => {
    console.log(text.slice(0, 3000));
  })
  .catch((err) => {
    console.error('ERROR', err);
  });
