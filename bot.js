require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON);

let statusMessage = null;
let lastAlertTps = 0;
let lastAlertPing = 0;
const POLL_INTERVAL = 3000;
const ALERT_COOLDOWN = 300000;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
const ALERT_CHANNEL_ID = process.env.ALERT_CHANNEL_ID || '';
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID || '';

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

    checkPerformance(data);

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

async function checkPerformance(data) {
  if (!ALERT_CHANNEL_ID) return;
  var tps = typeof data.tps === 'number' ? data.tps : 20;
  var ping = data.server_ping_ms || 0;
  var now = Date.now();

  if (tps < 18 && now - lastAlertTps > ALERT_COOLDOWN) {
    lastAlertTps = now;
    try {
      var channel = await client.channels.fetch(ALERT_CHANNEL_ID);
      if (channel) {
        await channel.send('\u26a0\ufe0f **PERFORMANCE ALERT**\n> TPS turun ke `' + tps.toFixed(2) + '` (< 18)\n> Kemungkinan server lag!');
      }
    } catch (e) {}
  }

  if (ping > 200 && now - lastAlertPing > ALERT_COOLDOWN) {
    lastAlertPing = now;
    try {
      var channel = await client.channels.fetch(ALERT_CHANNEL_ID);
      if (channel) {
        await channel.send('\u26a1 **PING ALERT**\n> Server ping tinggi: `' + ping + 'ms` (> 200)');
      }
    } catch (e) {}
  }
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
      .setDescription('Show server status'),

    new SlashCommandBuilder()
      .setName('rules')
      .setDescription('Tampilkan rules server KlitikCraft'),

    new SlashCommandBuilder()
      .setName('info')
      .setDescription('Tampilkan info server KlitikCraft'),

    new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Buat ticket support')
      .addSubcommand(function(sub) {
        return sub.setName('create')
          .setDescription('Buat ticket baru')
          .addStringOption(function(opt) {
            return opt.setName('subject').setDescription('Subjek ticket').setRequired(true);
          })
          .addStringOption(function(opt) {
            return opt.setName('message').setDescription('Deskripsi masalah').setRequired(true);
          });
      })
      .addSubcommand(function(sub) {
        return sub.setName('close').setDescription('Tutup ticket ini');
      })
      .addSubcommand(function(sub) {
        return sub.setName('list').setDescription('Lihat semua ticket aktif');
      })
      .addSubcommand(function(sub) {
        return sub.setName('panel').setDescription('Kirim panel ticket');
      })
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
  if (interaction.isButton()) {
    if (interaction.customId === 'ticket_create') {
      var ModalBuilder = require('discord.js').ModalBuilder;
      var TextInputBuilder = require('discord.js').TextInputBuilder;
      var TextInputStyle = require('discord.js').TextInputStyle;
      var modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Buat Ticket');
      var subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel('Subjek')
        .setPlaceholder('Contoh: Laporan Bug, Appeal Ban, dll')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      var msgInput = new TextInputBuilder()
        .setCustomId('ticket_message')
        .setLabel('Deskripsi Masalah')
        .setPlaceholder('Jelaskan masalah kamu dengan detail...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);
      var row1 = new ActionRowBuilder().addComponents(subjectInput);
      var row2 = new ActionRowBuilder().addComponents(msgInput);
      modal.addComponents(row1, row2);
      await interaction.showModal(modal);
    } else if (interaction.customId === 'ticket_close') {
      var thread = interaction.channel;
      if (!thread.isThread()) return interaction.reply({ content: '\u274c Hanya bisa di ticket channel.', ephemeral: true });
      var { data: ticket } = await supabase.from('tickets').select('*').eq('thread_id', thread.id).eq('status', 'open').single();
      if (!ticket) return interaction.reply({ content: '\u274c Ticket tidak ditemukan.', ephemeral: true });
      await supabase.from('tickets').update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: interaction.user.tag }).eq('id', ticket.id);
      var closeEmbed = new EmbedBuilder()
        .setTitle('\u2705 Ticket Ditutup')
        .setDescription('Ticket ditutup oleh **' + interaction.user.tag + '**.\nChannel akan dihapus dalam 10 detik.')
        .setColor(0x22c55e)
        .setTimestamp(new Date());
      await interaction.reply({ embeds: [closeEmbed] });
      setTimeout(function() { thread.setArchived(true, 'Ticket ditutup').catch(function() {}); }, 10000);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ticket_modal') {
      var subject = interaction.fields.getTextInputValue('ticket_subject');
      var message = interaction.fields.getTextInputValue('ticket_message');
      await handleTicketCreate(interaction, subject, message);
    }
    return;
  }

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

  if (cmd === 'rules') {
    var rulesEmbed = new EmbedBuilder()
      .setTitle('\ud83d\udccb Rules KlitikCraft')
      .setColor(0x22c55e)
      .setDescription(
        '**1.** Dilarang menggunakan cheat / hack / exploit.\n' +
        '**2.** Dilarang griefing (merusak build orang lain).\n' +
        '**3.** Dilarang scam / penipuan antar player.\n' +
        '**4.** Dilarang spam di chat atau flood.\n' +
        '**5.** Dilarang toxic, rasisme, atau SARA.\n' +
        '**6.** Dilarang NSFW / konten tidak pantas.\n' +
        '**7.** Dilarang melakukan oper jual beli akun / item RL.\n' +
        '**8.** Hormati admin dan sesama player.\n' +
        '**9.** Dilarang bug abuse / duping item.\n' +
        '**10.** Ikuti keputusan admin, keputusan bersifat final.'
      )
      .setFooter({ text: 'KlitikCraft Indonesia' })
      .setTimestamp(new Date());
    return reply(interaction, { embeds: [rulesEmbed] });
  }

  if (cmd === 'info') {
    var result = await supabase.from('server_state').select('*').eq('id', 1).single();
    var data = result.data;
    var online = data ? data.online : false;
    var version = data ? data.version : '--';
    var players = data ? data.players_online + '/' + data.players_max : '0/0';
    var infoEmbed = new EmbedBuilder()
      .setTitle('\ud83c\udf3f Info KlitikCraft Indonesia')
      .setColor(0x22c55e)
      .setDescription('**Server Minecraft Indonesia**\nSurvival-friendly, Tanpa Pay-to-Win!')
      .addFields(
        { name: '\ud83d\udfe2 Status', value: online ? '**Online**' : '**Offline**', inline: true },
        { name: '\ud83d\udcbb Version', value: '**' + version + '**', inline: true },
        { name: '\ud83d\udc65 Players', value: '**' + players + '**', inline: true },
        { name: '\ud83c\udf0d IP Server', value: '`play.klitikcraft.web.id`', inline: false },
        { name: '\ud83d\udd17 Website', value: '[klitikcraft.web.id](https://www.klitikcraft.web.id)', inline: false },
        { name: '\ud83d\udcac Commands', value: '`/status` - Lihat status server\n`/rules` - Lihat rules\n`/info` - Info server\n`/ticket create` - Buat ticket', inline: false }
      )
      .setFooter({ text: 'KlitikCraft Indonesia' })
      .setTimestamp(new Date());
    return reply(interaction, { embeds: [infoEmbed] });
  }

  if (cmd === 'ticket') {
    var sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      if (!isAdmin(interaction.member)) return reply(interaction, '\u274c Hanya admin.');
      var panelEmbed = new EmbedBuilder()
        .setTitle('\ud83d\udcac KlitikCraft Support')
        .setDescription('Butuh bantuan? Klik tombol di bawah untuk membuat ticket.\nAdmin akan segera merespons.')
        .setColor(0x5865F2)
        .setFooter({ text: 'KlitikCraft Support' });
      var btn = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_create').setLabel('Buat Ticket').setStyle(ButtonStyle.Primary)
      );
      return interaction.reply({ embeds: [panelEmbed], components: [btn] });
    }

    if (sub === 'create') {
      var subject = interaction.options.getString('subject');
      var message = interaction.options.getString('message');
      return handleTicketCreate(interaction, subject, message);
    }

    if (sub === 'close') {
      var thread = interaction.channel;
      if (!thread.isThread()) return reply(interaction, '\u274c Command ini hanya bisa dipakai di ticket channel.');

      var { data: ticket } = await supabase.from('tickets').select('*').eq('thread_id', thread.id).eq('status', 'open').single();
      if (!ticket) return reply(interaction, '\u274c Ticket tidak ditemukan atau sudah ditutup.');

      await supabase.from('tickets').update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: interaction.user.tag }).eq('id', ticket.id);

      var closeEmbed = new EmbedBuilder()
        .setTitle('\u2705 Ticket Ditutup')
        .setDescription('Ticket ditutup oleh **' + interaction.user.tag + '**.\nChannel akan dihapus dalam 10 detik.')
        .setColor(0x22c55e)
        .setTimestamp(new Date());
      await interaction.reply({ embeds: [closeEmbed] });

      setTimeout(function() {
        thread.setArchived(true, 'Ticket ditutup').catch(function() {});
      }, 10000);
      return;
    }

    if (sub === 'list') {
      if (!isAdmin(interaction.member)) return reply(interaction, '\u274c Hanya admin.');

      var { data: tickets } = await supabase.from('tickets').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(25);

      if (!tickets || tickets.length === 0) return reply(interaction, '\ud83d\udccb Tidak ada ticket aktif.');

      var list = '';
      for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        var time = new Date(t.created_at);
        var ago = Math.floor((Date.now() - time.getTime()) / 60000);
        list += '**#' + t.id + '** - ' + t.subject + '\n';
        list += '> Oleh: ' + t.username + ' | ' + ago + ' menit lalu\n';
      }

      var listEmbed = new EmbedBuilder()
        .setTitle('\ud83d\udccb Ticket Aktif (' + tickets.length + ')')
        .setDescription(list)
        .setColor(0x5865F2)
        .setTimestamp(new Date());
      return reply(interaction, { embeds: [listEmbed] });
    }
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

async function handleTicketCreate(interaction, subject, message) {
  if (!TICKET_CATEGORY_ID) return reply(interaction, '\u274c Ticket system belum dikonfigurasi.');

  var { data: existing } = await supabase.from('tickets').select('*').eq('user_id', interaction.user.id).eq('status', 'open').single();
  if (existing) return reply(interaction, '\u274c Kamu sudah punya ticket aktif: **#' + existing.id + '**. Tutup dulu sebelum buat baru.');

  var channel = await interaction.guild.channels.create({
    name: 'ticket-' + interaction.user.username,
    type: ChannelType.GuildText,
    parent: TICKET_CATEGORY_ID,
    permissionOverwrites: [
      { id: interaction.guild.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
    ]
  });

  await supabase.from('tickets').insert({
    thread_id: channel.id,
    channel_id: channel.parentId || '',
    user_id: interaction.user.id,
    username: interaction.user.tag,
    subject: subject,
    status: 'open'
  });

  var ticketEmbed = new EmbedBuilder()
    .setTitle('\ud83d\udcac Ticket #' + channel.name.replace('ticket-', ''))
    .setDescription('Halo **' + interaction.user.tag + '**, ticket kamu sudah dibuat.\nAdmin akan segera merespons.')
    .addFields(
      { name: '\ud83d\udcdd Subjek', value: subject, inline: false },
      { name: '\ud83d\udcac Pesan', value: message, inline: false }
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'Klik /ticket close untuk menutup ticket' })
    .setTimestamp(new Date());

  var closeBtn = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Tutup Ticket').setStyle(ButtonStyle.Danger)
  );

  await channel.send({ content: '<@' + interaction.user.id + '> <@&' + (process.env.ADMIN_ROLE_ID || '') + '>', embeds: [ticketEmbed], components: [closeBtn] });

  reply(interaction, '\u2705 Ticket dibuat: ' + channel.toString(), true);
}

client.login(process.env.DISCORD_TOKEN);
