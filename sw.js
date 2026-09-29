/* Service worker de « Meliza la vache gourmande ».
   Stratégie « stale-while-revalidate » : le jeu s'ouvre instantanément et
   fonctionne hors-ligne, tout en se mettant à jour à la visite suivante.
   Tous les chemins sont relatifs, l'appli peut donc vivre dans un sous-dossier. */

var VERSION = 'meliza-v2';
var FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icone-180.png',
  'icone-192.png',
  'icone-512.png'
];

self.addEventListener('install', function (evenement) {
  evenement.waitUntil(
    caches.open(VERSION).then(function (cache) {
      // Chaque fichier est mis en cache indépendamment : si l'un manque,
      // l'installation aboutit quand même.
      return Promise.all(FICHIERS.map(function (chemin) {
        return cache.add(new Request(chemin, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evenement) {
  evenement.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms.map(function (nom) {
        return nom === VERSION ? null : caches.delete(nom);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evenement) {
  var requete = evenement.request;
  if (requete.method !== 'GET') return;

  var url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  evenement.respondWith(servir(requete));
});

function servir(requete) {
  return caches.open(VERSION).then(function (cache) {
    return cache.match(requete, { ignoreSearch: true }).then(function (enCache) {
      var reseau = fetch(requete).then(function (reponse) {
        if (reponse && reponse.ok && reponse.type === 'basic') {
          cache.put(requete, reponse.clone());
        }
        return reponse;
      }).catch(function () { return null; });

      if (enCache) return enCache;   // réponse immédiate, mise à jour en arrière-plan

      return reseau.then(function (reponse) {
        if (reponse) return reponse;
        // Hors-ligne : on retombe sur la page du jeu.
        return cache.match('index.html').then(function (page) {
          if (page) return page;
          return new Response('Contenu indisponible hors-ligne.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      });
    });
  });
}
