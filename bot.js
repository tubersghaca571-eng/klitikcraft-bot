require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON);

let statusMessage = null;
const POLL_INTERVAL = 3000;

const DIVIDER = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';

function progressBar(value, max, size) {
  size = size || 10;
  var filled = Math.round((value / max) * size);
  if (filled > size) filled = size;
  var empty = size - filled;
  var bar = '';
  for (var i = 0; i < filled; i++) bar += '\u2588';
  for (var i = 0; i < empty; i++) bar += '\u2591';
  return bar;
}

function tpsLabel(tps) {
  if (tps >= 19.5) return '\ud83d\udfe2 Excellent';
  if (tps >= 18) return '\ud83d\udfe1 Good';
  if (tps >= 15) return '\ud83d\udfe0 Low';
  return '\u274c Critical';
}

function pingLabel(ping) {
  if (ping <= 50) return '\ud83d\udfe2 Excellent';
  if (ping <= 100) return '\ud83d\udfe1 Good';
  if (ping <= 200) return '\ud83d\udfe0 High';
  return '\u274c Very High';
}

function tpsColor(tps) {
  if (tps >= 19.5) return 0x22c55e;
  if (tps >= 18) return 0xf59e0b;
  return 0xef4444;
}

function fmtUptime(startIso) {
  if (!startIso) return '--';
  var ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0) return '--';
  var s = Math.floor(ms / 1000);
  var d = Math.floor(s / 86400);
  var h = Math.floor((s % 86400) / 3600);
  var m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'j ' + m + 'm';
  if (h > 0) return h + 'j ' + m + 'm';
  return m + 'm';
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

  var playerList = '';
  if (players.length > 0) {
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var pPing = p.ping || 0;
      var pWorld = p.world || 'world';
      playerList += '> \ud83d\udfe2 **' + p.name + '**\n';
      playerList += '> \u26a1 `' + pPing + ' ms`  \u2022  \ud83c\udf0d `' + pWorld + '`\n';
      playerList += '> Status: `Online`\n';
    }
  } else {
    playerList = '> Tidak ada pemain online';
  }

  var now = new Date();
  var wib = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  var timeStr = wib.getUTCHours().toString().padStart(2, '0') + ':' +
                wib.getUTCMinutes().toString().padStart(2, '0') + ':' +
                wib.getUTCSeconds().toString().padStart(2, '0') + ' WIB';

  var embed = new EmbedBuilder()
    .setTitle('\ud83c\udf3f **KLITIKCRAFT INDONESIA**')
    .setDescription('`SURVIVAL \u2022 JAVA + BEDROCK`')
    .setColor(online ? tpsColor(tps) : 0xef4444)
    .setThumbnail('https://mc-heads.net/avatar/KlitikCraft/128')
    .addFields(
      { name: '', value: (online ? '\ud83d\udfe2' : '\u274c') + ' **SERVER ' + (online ? 'ONLINE' : 'OFFLINE') + '**\n> Server berjalan normal dan dapat diakses.', inline: false },
      { name: '', value: DIVIDER, inline: false },
      { name: '\ud83c\udfb2 **TPS**', value: '`' + tps.toFixed(2) + '`  ' + tpsLabel(tps), inline: true },
      { name: '\u26a1 **PING SERVER**', value: '`' + ping + ' ms`  ' + pingLabel(ping), inline: true },
      { name: '\ud83d\udc65 **PLAYERS**', value: '`' + playersOnline + ' / ' + playersMax + '`', inline: true },
      { name: '\u23f0 **UPTIME**', value: '`' + uptime + '`', inline: true },
      { name: '\ud83d\udcbb **VERSION**', value: '`' + version + '`', inline: true },
      { name: '', value: '', inline: true },
      { name: '', value: DIVIDER, inline: false },
      { name: '\ud83c\udfae **PEMAIN ONLINE** `' + players.length + '`', value: playerList, inline: false },
      { name: '', value: DIVIDER, inline: false },
      { name: '\ud83d\udcca **SERVER HEALTH**', value: 'TPS       `' + tps.toFixed(2) + '`  ' + progressBar(tps, 20, 8) + '\nPing      `' + ping + ' ms` ' + progressBar(ping <= 300 ? 300 - ping : 0, 300, 8) + '\nPlayers   `' + playersOnline + ' / ' + playersMax + '` ' + progressBar(playersOnline, playersMax || 1, 8), inline: false },
      { name: '', value: DIVIDER, inline: false },
      { name: '\ud83d\udd50 **Last Update**', value: '`' + timeStr + '`', inline: false }
    )
    .setFooter({ text: '\ud83e\udd16 KlitikCraft Status Bot | Auto-update setiap 3 detik' })
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
