const tracks = [
  { id: 'osi', label: 'OSI', categories: ['OSI', '表示層', '應用層', '實體層', 'OSI / TCP/IP'] },
  { id: 'tcp-ip', label: 'TCP/IP', categories: ['TCP/IP', '網路通訊'] },
  { id: 'packet', label: '封包', categories: ['封包'] },
  { id: 'ip', label: 'IP 位址', categories: ['IP 位址', '網路架構'] },
  { id: 'config', label: '網路設定', categories: ['網路設定'] },
  { id: 'dns', label: 'DNS', categories: ['DNS', '網路服務'] },
  { id: 'arp', label: 'ARP', categories: ['ARP'] },
  { id: 'ethernet', label: '乙太網路', categories: ['乙太網路'] },
  { id: 'devices', label: '網路設備', categories: ['網路設備'] },
  { id: 'security', label: '網路安全', categories: ['網路安全'] }
];

const ranks = ['初識者', '觀察員', '辨識手', '巡線員', '分析員', '熟手', '導航員', '研究者', '守望者', '架構師'];
const milestones = [1, 2, 4, 6, 9, 13, 18, 25, 35, 50];

function topicForCategory(category) {
  return tracks.find(track => track.categories.includes(category))?.id || null;
}

function titlesForStats(stats) {
  return tracks.flatMap(track => milestones.flatMap((required, index) =>
    Number(stats[track.id] || 0) >= required
      ? [{ id: `${track.id}-${index + 1}`, topic: track.label, level: index + 1, name: `${track.label}・${ranks[index]}`, required }]
      : []
  ));
}

module.exports = { tracks, milestones, topicForCategory, titlesForStats };
