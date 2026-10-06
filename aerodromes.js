// Données d'aérodromes de Nouvelle-Aquitaine utilisées pour générer les exercices.
// ⚠️ INDICATIVES : pistes et fréquences sont à vérifier et corriger sur les cartes VAC
// du SIA (https://www.sia.aviation-civile.gouv.fr) avant de s'y fier. Modifie librement ce fichier.
//
// kind : 'afis' (AFIS ouvert), 'twr' (tour de contrôle), 'auto' (auto-information)
// rwys : les deux QFU de la piste principale, sous forme "11" / "29"

export const AERODROMES = [
  // Aérodromes AFIS
  { oaci: 'LFBX', name: 'Périgueux', full: 'Périgueux-Bassillac', kind: 'afis', rwys: ['11', '29'], freq: '119.255' },
  { oaci: 'LFCH', name: 'Arcachon', full: 'Arcachon-La Teste-de-Buch', kind: 'afis', rwys: ['10', '28'], freq: '118.375' },
  { oaci: 'LFBU', name: 'Angoulême', full: 'Angoulême-Brie-Champniers', kind: 'afis', rwys: ['10', '28'], freq: '118.350' },
  { oaci: 'LFBN', name: 'Niort', full: 'Niort-Souché', kind: 'afis', rwys: ['07', '25'], freq: '118.200' },
  { oaci: 'LFCY', name: 'Royan', full: 'Royan-Médis', kind: 'afis', rwys: ['10', '28'], freq: '118.550' },
  { oaci: 'LFSL', name: 'Brive', full: 'Brive-Souillac', kind: 'afis', rwys: ['11', '29'], freq: '119.400' },

  // Aérodromes contrôlés
  { oaci: 'LFBE', name: 'Bergerac', full: 'Bergerac-Dordogne-Périgord', kind: 'twr', rwys: ['10', '28'], freq: '120.150' },
  { oaci: 'LFBH', name: 'La Rochelle', full: 'La Rochelle-Île de Ré', kind: 'twr', rwys: ['09', '27'], freq: '118.200' },
  { oaci: 'LFBA', name: 'Agen', full: 'Agen-La Garenne', kind: 'twr', rwys: ['11', '29'], freq: '118.100' },

  // Aérodromes en auto-information
  { oaci: 'LFCD', name: 'Andernos', full: 'Andernos-les-Bains', kind: 'auto', rwys: ['08', '26'], freq: '123.500' },
  { oaci: 'LFDK', name: 'Soulac', full: 'Soulac-sur-Mer', kind: 'auto', rwys: ['10', '28'], freq: '123.500' },
  { oaci: 'LFDI', name: 'Libourne', full: 'Libourne-Artigues-de-Lussac', kind: 'auto', rwys: ['09', '27'], freq: '123.500' },
  { oaci: 'LFCS', name: 'Léognan', full: 'Bordeaux-Léognan-Saucats', kind: 'auto', rwys: ['06', '24'], freq: '123.500' },
];
