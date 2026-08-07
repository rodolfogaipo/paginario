// Service worker mínimo — necessário para o Chrome/Android oferecer
// "Instalar app" de verdade (com ícone e tela cheia) em vez de só um atalho.
// Não faz cache agressivo por enquanto, só deixa o app "instalável".

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Passa direto pra rede — sem cache offline por enquanto.
});
