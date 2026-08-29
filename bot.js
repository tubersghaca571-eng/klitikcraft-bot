require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON);

let statusMessage = null;
const POLL_INTERVAL = 3000;

function fmtUptime(startIso) {
  if (!startIso) return '--';
  const ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0) return '--';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'j ' + m + 'm';
  if (h > 0) return h + 'j ' + m + 'm';
  return m + 'm';
}

function tpsColor(tps) {
  if (tps >= 19.5) return 0x22c55e;
  if (tps >= 18) return 0xf59e0b;
  return 0xef4444;
}

function tpsEmoji(tps) {
  if (tps >= 19.5) return '\u2705';
  if (tps >= 18) return '\u26a0\ufe0f';
  return '\u274c';
}

function buildEmbed(data) {
  var online = data.online;
  var tps = typeof data.tps === 'number' ? data.tps : 0;
  var ping = data.server_ping_ms || 0;
  var playersOnline = data.players_online || 0;
  var playersMax = data.players_max || 0;
  var uptime = fmtUptime(data.started_at);
  var version = data.version || '--';
  var players = Array.isArray(data.players) ? data.players : [];
  var playerNames = players.length > 0
    ? players.map(function(p) { return p.name; }).join(', ')
    : 'Tidak ada pemain online';

  var embed = new EmbedBuilder()
    .setTitle('KlitikCraft Indonesia')
    .setColor(online ? tpsColor(tps) : 0xef4444)
    .setThumbnail('https://mc-heads.net/avatar/KlitikCraft/128')
    .addFields(
      { name: (online ? '\ud83d\udfe2' : '\u274c') + ' Status', value: online ? '**Online**' : '**Offline**', inline: true },
      { name: '\ud83c\udfb2 TPS', value: '**' + tps.toFixed(2) + '** ' + tpsEmoji(tps), inline: true },
      { name: '\u26a1 Ping', value: '**' + ping + 'ms**', inline: true },
      { name: '\ud83d\udc65 Pemain', value: '**' + playersOnline + '** / **' + playersMax + '**', inline: true },
      { name: '\u23f0 Uptime', value: '**' + uptime + '**', inline: true },
      { name: '\ud83d\udcbb Version', value: '**' + version + '**', inline: true },
      { name: '\ud83c\udfae Pemain Online', value: playerNames.length > 1024 ? playerNames.slice(0, 1021) + '...' : playerNames, inline: false }
    )
    .setFooter({ text: 'KlitikCraft Status Bot - Auto-update setiap 3 detik' })
    .setTimestamp(new Date());

  return embed;
}

async function updateStatus() {
  try {
    console.log('Fetching server state...');
    var result = await supabase.from('server_state').select('*').eq('id', 1).single();
    var data = result.data;
    console.log('Data:', JSON.stringify(data));
    if (!data) return;

    var embed = buildEmbed(data);

    if (statusMessage) {
      await statusMessage.edit({ embeds: [embed] }).catch(function() {});
    } else {
      console.log('Fetching channel...');
      var channel = await client.channels.fetch(process.env.CHANNEL_ID);
      if (!channel) { console.log('Channel not found!'); return; }
      console.log('Channel found: ' + channel.name);

      var messages = await channel.messages.fetch({ limit: 10 });
      statusMessage = messages.find(function(m) {
        return m.author.id === client.user.id && m.embeds.length > 0;
      });

      if (statusMessage) {
        await statusMessage.edit({ embeds: [embed] }).catch(function() {});
      } else {
        statusMessage = await channel.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    console.error('Update error:', e.message, e.stack);
  }
}

client.once('ready', function() {
  console.log('Bot logged in as ' + client.user.tag);
  console.log('Channel ID: ' + process.env.CHANNEL_ID);
  client.user.setActivity('KlitikCraft', { type: 3 });
  updateStatus().then(function() {
    console.log('First update done');
    setInterval(updateStatus, POLL_INTERVAL);
  }).catch(function(e) {
    console.error('First update failed:', e.message);
  });
});

client.login(process.env.DISCORD_TOKEN);
