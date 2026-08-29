require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON);

let statusMessage = null;
const POLL_INTERVAL = 3000;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);

const DIVIDER = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';

function isAdmin(member) {
  if (ADMIN_IDS.length > 0 && ADMIN_IDS.includes(member.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return false;
}

function progressBar(value, max, size) {
  size = size || 8;
  var filled = Math.round((value / max) * size);
  if (filled > size) filled = size;
  var empty = size - filled;
  var bar = '';
  for (var i = 0; i < filled; i++) bar += '\ud83d\udfe9';
  for (var i = 0; i < empty; i++) bar += '\u2B1C';
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
      playerList += '> \ud83d\udfe2 **' + p.name + '**\n';
      playerList += '> \u26a1 `' + (p.ping || 0) + ' ms`  \u2022  \ud83c\udf0d `' + (p.world || 'world') + '`\n';
    }
  } else {
    playerList = '> Tidak ada pemain online';
  }

  var now = new Date();
  var wib = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  var timeStr = wib.getUTCHours().toString().padStart(2, '0') + ':' +
                wib.getUTCMinutes().toString().padStart(2, '0') + ':' +
                wib.getUTCSeconds().toString().padStart(2, '0') + ' WIB';

  return new EmbedBuilder()
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
      { name: '\ud83d\udcca **SERVER HEALTH**', value: 'TPS       `' + tps.toFixed(2) + '`  ' + progressBar(tps, 20) + '\nPing      `' + ping + ' ms` ' + progressBar(ping <= 300 ? 300 - ping : 0, 300) + '\nPlayers   `' + playersOnline + ' / ' + playersMax + '` ' + progressBar(playersOnline, playersMax || 1), inline: false },
      { name: '', value: DIVIDER, inline: false },
      { name: '\ud83d\udd50 **Last Update**', value: '`' + timeStr + '`', inline: false }
    )
    .setFooter({ text: '\ud83e\udd16 KlitikCraft Status Bot | Auto-update setiap 3 detik' })
    .setTimestamp(new Date());
}

async function updateStatus() {
  try {
    var result = await supabase.from('server_state').select('*').eq('id', 1).single();
    var data = result.data;
    if (!data) return;

    var embed = buildEmbed(data);

    if (statusMessage) {
      await statusMessage.edit({ embeds: [embed] }).catch(function() {});
    } else {
      var channel = await client.channels.fetch(process.env.CHANNEL_ID);
      if (!channel) return;

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
    console.error('Update error:', e.message);
  }
}

async function sendCommand(action, target, createdBy) {
  var { error } = await supabase.from('admin_commands').insert({
    action: action,
    target: target || '',
    created_by: createdBy
  });
  return error ? error.message : null;
}

function reply(interaction, content, ephemeral) {
  return interaction.reply({ content: content, ephemeral: ephemeral !== false });
}

client.once('ready', async function() {
  console.log('Bot logged in as ' + client.user.tag);

  var commands = [
    new SlashCommandBuilder()
      .setName('restart')
      .setDescription('Restart Minecraft server')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Stop Minecraft server')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick player from server')
      .addStringOption(function(opt) {
        return opt.setName('player').setDescription('Player name').setRequired(true);
      })
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban player from server')
      .addStringOption(function(opt) {
        return opt.setName('player').setDescription('Player name').setRequired(true);
      })
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Unban player from server')
      .addStringOption(function(opt) {
        return opt.setName('player').setDescription('Player name').setRequired(true);
      })
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Show server status')
  ];

  var rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('Slash commands registered');
  } catch (e) {
    console.error('Failed to register commands:', e.message);
  }

  client.user.setActivity('KlitikCraft', { type: 3 });
  updateStatus().then(function() {
    setInterval(updateStatus, POLL_INTERVAL);
  });
});

client.on('interactionCreate', async function(interaction) {
  if (!interaction.isChatInputCommand()) return;

  var cmd = interaction.commandName;

  if (cmd === 'status') {
    await interaction.deferReply({ ephemeral: true });
    var result = await supabase.from('server_state').select('*').eq('id', 1).single();
    var data = result.data;
    if (!data) return reply(interaction, '\u274c Tidak bisa ambil data server.');
    var embed = buildEmbed(data);
    return interaction.editReply({ embeds: [embed] });
  }

  if (!isAdmin(interaction.member)) {
    return reply(interaction, '\u274c Hanya admin yang bisa pakai command ini.');
  }

  if (cmd === 'restart') {
    var err = await sendCommand('restart', '', interaction.user.tag);
    if (err) return reply(interaction, '\u274c Gagal: ' + err);
    return reply(interaction, '\ud83d\udd04 Restart command dikirim. Server akan restart dalam beberapa detik.');

  } else if (cmd === 'stop') {
    var err = await sendCommand('kick-all', '', interaction.user.tag);
    if (err) return reply(interaction, '\u274c Gagal: ' + err);
    return reply(interaction, '\u23f9\ufe0f Stop command dikirim. Semua player akan dikick dan server berhenti.');

  } else if (cmd === 'kick') {
    var player = interaction.options.getString('player');
    var err = await sendCommand('kick', player, interaction.user.tag);
    if (err) return reply(interaction, '\u274c Gagal: ' + err);
    return reply(interaction, '\ud83d\udcb6 Kick command dikirim untuk **' + player + '**.');

  } else if (cmd === 'ban') {
    var player = interaction.options.getString('player');
    var err = await sendCommand('ban', player, interaction.user.tag);
    if (err) return reply(interaction, '\u274c Gagal: ' + err);
    return reply(interaction, '\ud83d\udeab Ban command dikirim untuk **' + player + '**.');

  } else if (cmd === 'unban') {
    var player = interaction.options.getString('player');
    var err = await sendCommand('unban', player, interaction.user.tag);
    if (err) return reply(interaction, '\u274c Gagal: ' + err);
    return reply(interaction, '\u2705 Unban command dikirim untuk **' + player + '**.');
  }
});

client.login(process.env.DISCORD_TOKEN);
